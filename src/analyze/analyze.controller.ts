import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AnalyzeUrlDto } from './dto/analyze-url.dto';
import { AnalyzeService } from './analyze.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@Controller('analyze')
export class AnalyzeController {
  constructor(
    private readonly analyzeService: AnalyzeService,
    private readonly rateLimitGuard: RateLimitGuard,
  ) {}

  @Post()
  @HttpCode(200)
  async analyze(
    @Body() body: AnalyzeUrlDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.rateLimitGuard.enforce(req);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.socket?.setNoDelay(true);
    res.flushHeaders();

    try {
      for await (const event of this.analyzeService.analyze(body.url)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Analysis failed';
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    }

    res.end();
  }
}
