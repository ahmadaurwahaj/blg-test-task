import { Module } from '@nestjs/common';

import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { ChatgptService } from './chatgpt.service';
import { CrawlerService } from './crawler.service';
import { GeminiService } from './gemini.service';
import { ScoringService } from './scoring.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@Module({
  controllers: [AnalyzeController],
  providers: [
    AnalyzeService,
    ChatgptService,
    CrawlerService,
    GeminiService,
    ScoringService,
    RateLimitGuard,
  ],
})
export class AnalyzeModule {}
