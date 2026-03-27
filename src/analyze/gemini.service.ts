import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

import {
  WebsiteAnalysis,
  GroundedResponse,
  BrandExtraction,
  Citation,
  PromptResult,
} from './interfaces/analysis.interface';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly promptAi: GoogleGenAI;
  private readonly queryAi: GoogleGenAI;
  private readonly scoringAi: GoogleGenAI;

  constructor(private readonly config: ConfigService) {
    this.promptAi = new GoogleGenAI({
      apiKey: this.config.getOrThrow<string>('GEMINI_PROMPT_API_KEY'),
    });
    this.queryAi = new GoogleGenAI({
      apiKey: this.config.getOrThrow<string>('GEMINI_QUERY_API_KEY'),
    });
    this.scoringAi = new GoogleGenAI({
      apiKey: this.config.getOrThrow<string>('GEMINI_SCORING_API_KEY'),
    });
  }

  async generatePrompts(
    url: string,
    content: string,
  ): Promise<WebsiteAnalysis> {
    this.logger.log(`Generating analysis prompts for ${url}`);

    const response = await this.promptAi.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
You are an SEO and AI visibility analyst.

Analyze this website content and respond with a JSON object containing:

1. "brand_name": The company/product name
2. "description": What they do in 1-2 sentences
3. "target_audience": Who their customers are
4. "industry": The industry/domain
5. "key_features": Top 3-5 features or services
6. "prompts": An array of 5 search prompts that potential customers would type into ChatGPT or Gemini when looking for solutions this website provides. Each prompt should have:
   - "stage": One of "awareness", "consideration", "decision", "problem_focused", "solution_focused"
   - "query": The natural language prompt a user would type

Rules for generating prompts:
- NEVER mention the brand name in any prompt
- Make prompts sound natural, like a real person asking ChatGPT
- Cover different stages of the buying journey
- Be specific to the industry and use case, not generic
- Be a query where this brand or website has a realistic chance of being recommended

Website URL: ${url}
Website content:
${content}
`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            brand_name: { type: 'string' },
            description: { type: 'string' },
            target_audience: { type: 'string' },
            industry: { type: 'string' },
            key_features: {
              type: 'array',
              items: { type: 'string' },
            },
            prompts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  stage: { type: 'string' },
                  query: { type: 'string' },
                },
                required: ['stage', 'query'],
              },
            },
          },
          required: [
            'brand_name',
            'description',
            'target_audience',
            'industry',
            'key_features',
            'prompts',
          ],
        },
        temperature: 0.7,
      },
    });

    return JSON.parse(response.text ?? '{}') as unknown as WebsiteAnalysis;
  }

  async queryWithGrounding(query: string): Promise<GroundedResponse> {
    const response = await this.queryAi.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    type GroundingChunk = { web?: { uri?: string; title?: string } };
    const citations: Citation[] =
      groundingMetadata?.groundingChunks?.map((chunk: unknown) => {
        const web = (chunk as GroundingChunk).web;
        const uri = web?.uri ?? '';
        const title = web?.title ?? '';
        let domain: string | null = null;
        if (uri) {
          try {
            const hostname = new URL(uri).hostname;
            domain =
              hostname === 'vertexaisearch.cloud.google.com'
                ? title || hostname
                : hostname;
          } catch {
            domain = null;
          }
        }
        return { url: uri, title, domain };
      }) ?? [];

    return { text: response.text ?? '', citations };
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
    const { text, citations } = await this.queryWithGrounding(prompt.query);
    const brandData = await this.extractBrands(text, prompt.query, targetBrand);

    return {
      query: prompt.query,
      stage: prompt.stage,
      response: text,
      citations,
      brands: brandData.brands,
      targetBrandFound: brandData.target_brand_found,
      targetBrandMentions: brandData.target_brand_mentions,
    };
  }
}
