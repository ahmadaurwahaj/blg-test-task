import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyzeService {
  private delay<T>(value: T, ms: number): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(Promise.resolve(value)), ms);
    });
  }

  async *streamAnalysis(url: string): AsyncGenerator<string> {
    const steps = [
      `Starting analysis for: ${url}`,
      'Fetching metadata...',
      'Checking content signals...',
      'Scoring relevance...',
      'Analysis complete.',
    ];

    for (const step of steps) {
      const message = await this.delay(step, 500);
      yield message;
    }
  }
}
