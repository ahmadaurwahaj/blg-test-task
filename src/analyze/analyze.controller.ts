import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnalyzeUrlDto } from './dto/analyze-url.dto';
import { AnalyzeService } from './analyze.service';
import { normalizeMarkdown } from './utils';
import { analyzeAndGeneratePrompts, runFullAnalysis, calculateScores } from './gemini';
@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post()
  async analyze(@Body() body: AnalyzeUrlDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const url = 'https://www.ahmadwahaj.com';
    res.write(`data: ${JSON.stringify({ message: 'Crawling...' })}\n\n`);

    const crawlResponse = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer jina_080151f0e8914e2c9b2a569c91d76515bblp_DONzP5RWbVC9r0jJwXbrYvn',
        'X-Cache-Tolerance': '300',
        'X-Retain-Images': 'none',
        'X-Wait-For-Selector': 'body, .class, #id',
      }
    });
    
    const text = await crawlResponse.text();
    console.log("raw text", text);
    const normalizedText = normalizeMarkdown(text);
    res.write(`Crawling complete`);

    console.log("normalized text", normalizedText);
    res.write(`Generating prompts...`);
    const analysis = await analyzeAndGeneratePrompts(url, normalizedText);
    console.log("prompts", analysis);
    if(!analysis) res.end;
    const results = await runFullAnalysis(analysis.prompts, analysis.brand_name);
    const scores = calculateScores(results, analysis.brand_name);
    console.log("Results", results)
    console.log("Scores", scores)
    res.write(`Prompts generated`);
    
    res.end();
  }
}
