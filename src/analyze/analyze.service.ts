import { Injectable, Logger } from '@nestjs/common';

import { ChatgptService } from './chatgpt.service';
import { CrawlerService } from './crawler.service';
import { GeminiService } from './gemini.service';
import { ScoringService } from './scoring.service';
import { normalizeMarkdown } from './utils';
import { PromptResult, SseEvent } from './interfaces/analysis.interface';

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    private readonly crawler: CrawlerService,
    private readonly gemini: GeminiService,
    private readonly chatgpt: ChatgptService,
    private readonly scoring: ScoringService,
  ) {}

  async *analyze(url: string): AsyncGenerator<SseEvent> {
    this.logger.log(`Starting analysis for ${url}`);

    yield { type: 'progress', stage: 'Crawling website' };
    const rawContent = await this.crawler.crawl(url);
    const content = normalizeMarkdown(rawContent);
    yield { type: 'progress', stage: 'Crawling done' };

    yield { type: 'progress', stage: 'Generating relevant prompts' };
    const analysis = await this.gemini.generatePrompts(url, content);

    if (!analysis?.prompts?.length) {
      yield { type: 'error', message: 'Failed to generate analysis prompts' };
      return;
    }

    const promptCount = analysis.prompts.length;
    yield {
      type: 'progress',
      stage: `Prompts generated (${promptCount} prompts)`,
    };

    const geminiResults: PromptResult[] = [];
    const chatgptResults: PromptResult[] = [];
    let lastGeminiError: string | null = null;
    let lastChatgptError: string | null = null;

    for (let i = 0; i < promptCount; i++) {
      const prompt = analysis.prompts[i];
      yield {
        type: 'progress',
        stage: `Querying Gemini & ChatGPT for prompt ${i + 1}/${promptCount}`,
      };

      const [geminiResult, chatgptResult] = await Promise.allSettled([
        this.gemini.analyzePrompt(prompt, analysis.brand_name),
        this.chatgpt.analyzePrompt(prompt, analysis.brand_name),
      ]);

      if (geminiResult.status === 'fulfilled') {
        geminiResults.push(geminiResult.value);
      } else {
        const msg =
          geminiResult.reason instanceof Error
            ? geminiResult.reason.message
            : String(geminiResult.reason);
        lastGeminiError = msg;
        this.logger.warn(`Gemini prompt ${i + 1} failed: ${msg}`);
      }

      if (chatgptResult.status === 'fulfilled') {
        chatgptResults.push(chatgptResult.value);
      } else {
        const msg =
          chatgptResult.reason instanceof Error
            ? chatgptResult.reason.message
            : String(chatgptResult.reason);
        lastChatgptError = msg;
        this.logger.warn(`ChatGPT prompt ${i + 1} failed: ${msg}`);
      }
    }

    if (geminiResults.length === 0 && chatgptResults.length === 0) {
      const geminiMsg = this.extractQuotaMessage('Gemini', lastGeminiError);
      const chatgptMsg = this.extractQuotaMessage('ChatGPT', lastChatgptError);
      yield {
        type: 'error',
        message: `All LLM queries failed. ${geminiMsg} ${chatgptMsg}`.trim(),
      };
      return;
    }

    yield { type: 'progress', stage: 'Calculating scores' };

    const geminiScores = this.scoring.calculateLlmScores(
      'gemini',
      geminiResults,
      analysis.brand_name,
    );
    const chatgptScores = this.scoring.calculateLlmScores(
      'chatgpt',
      chatgptResults,
      analysis.brand_name,
    );
    const combined = this.scoring.combineScores(geminiScores, chatgptScores);

    this.logger.log(
      `Analysis complete — overall visibility: ${combined.overallVisibilityScore.toFixed(1)}%`,
    );

    yield { type: 'result', data: combined };
  }

  private extractQuotaMessage(llm: string, raw: string | null): string {
    if (!raw) return '';
    const isQuota =
      raw.includes('429') ||
      raw.includes('RESOURCE_EXHAUSTED') ||
      raw.toLowerCase().includes('quota');
    if (!isQuota) return `${llm} error: ${raw.slice(0, 120)}`;

    const retryMatch = /retry in ([\d.]+s)/i.exec(raw);
    const retry = retryMatch ? ` Retry after ${retryMatch[1]}.` : '';
    return `${llm} quota exceeded.${retry}`;
  }
}
