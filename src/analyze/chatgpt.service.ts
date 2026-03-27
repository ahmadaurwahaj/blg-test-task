import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import {
  BrandExtraction,
  Citation,
  GroundedResponse,
  PromptResult,
} from './interfaces/analysis.interface';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class ChatgptService {
  private readonly logger = new Logger(ChatgptService.name);
  private readonly client: OpenAI;
  private readonly scoringAi: GoogleGenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_QUERY_API_KEY'),
    });
    this.scoringAi = new GoogleGenAI({
      apiKey: this.config.getOrThrow<string>('GEMINI_SCORING_API_KEY'),
    });
  }

  async queryWithSearch(query: string): Promise<GroundedResponse> {
    const response = await this.client.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: query,
    });

    let text = '';
    const citations: Citation[] = [];
    const seenUrls = new Set<string>();

    for (const item of response.output) {
      if (item.type === 'message') {
        for (const block of item.content) {
          if (block.type === 'output_text') {
            text = block.text;
            for (const annotation of block.annotations) {
              if (
                annotation.type === 'url_citation' &&
                !seenUrls.has(annotation.url)
              ) {
                seenUrls.add(annotation.url);
                let domain: string | null = null;
                try {
                  domain = new URL(annotation.url).hostname;
                } catch {
                  domain = null;
                }
                citations.push({
                  url: annotation.url,
                  title: annotation.title ?? '',
                  domain,
                });
              }
            }
          }
        }
      }
    }

    return { text, citations };
  }

  async extractBrands(
    responseText: string,
    query: string,
    targetBrand: string,
  ): Promise<BrandExtraction> {
    const response = await this.scoringAi.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
Analyze this LLM response and extract all brand names, product names,
company names, tools, or platforms mentioned.

Original query: "${query}"
Target brand to look for: "${targetBrand}"

LLM Response:
${responseText}
`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            brands: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  mentions: { type: 'integer' },
                  context: { type: 'string' },
                },
                required: ['name', 'mentions'],
              },
            },
            target_brand_found: { type: 'boolean' },
            target_brand_mentions: { type: 'integer' },
          },
          required: ['brands', 'target_brand_found', 'target_brand_mentions'],
        },
      },
    });

    return JSON.parse(response.text ?? '{}') as unknown as BrandExtraction;
  }

  async analyzePrompt(
    prompt: { stage: string; query: string },
    targetBrand: string,
  ): Promise<PromptResult> {
    const { text, citations } = await this.queryWithSearch(prompt.query);
    const brandData = await this.extractBrands(text, prompt.query, targetBrand);

    return {
      query: prompt.query,
      stage: prompt.stage,
      response: text,
      citations,
      brands: brandData.brands ?? [],
      targetBrandFound: brandData.target_brand_found ?? false,
      targetBrandMentions: brandData.target_brand_mentions ?? 0,
    };
  }
}
