import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly jinaApiKey: string;
  private readonly jinaBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.jinaApiKey = this.config.getOrThrow<string>('JINA_API_KEY');
    this.jinaBaseUrl = this.config.get<string>(
      'JINA_BASE_URL',
      'https://r.jina.ai',
    );
  }

  async crawl(url: string): Promise<string> {
    this.logger.log(`Crawling ${url}`);

    const response = await fetch(`${this.jinaBaseUrl}/${url}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.jinaApiKey}`,
        'X-Cache-Tolerance': '300',
        'X-Retain-Images': 'none',
        'X-Wait-For-Selector': 'body',
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(
        `Crawl failed for ${url}: ${response.status} ${response.statusText}`,
      );
    }

    return response.text();
  }
}
