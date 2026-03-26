import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyCXhvP6C4hfYfeHeXrYo8iKWIECyrEj_Uw' });

export async function analyzeAndGeneratePrompts(url: string, normalizedContent: string) {
  const response = await ai.models.generateContent({
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
    ${normalizedContent}
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

  return JSON.parse(response.text || '{}');
}


export async function queryWithGrounding(query: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  // Extract citations from grounding metadata
  const candidate = response.candidates?.[0];
  const groundingMetadata = candidate?.groundingMetadata;

  const citations = groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    url: chunk.web?.uri,
    title: chunk.web?.title,
    domain: chunk.web?.uri ? new URL(chunk.web.uri).hostname : null,
  })) || [];

  return {
    text: response.text,
    citations,
  };
}


export async function extractBrands(
  responseText: string, 
  query: string, 
  targetBrand: string
) {
  const response = await ai.models.generateContent({
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

  return JSON.parse(response.text || '{}');
}

interface PromptResult {
  query: string;
  stage: string;
  response: string;
  citations: { url: string; title: string; domain: string }[];
  brands: { name: string; mentions: number; context?: string }[];
  targetBrandFound: boolean;
  targetBrandMentions: number;
}

export async function runFullAnalysis(
  prompts: { stage: string; query: string }[],
  targetBrand: string
): Promise<PromptResult[]> {

  const results = await Promise.allSettled(
    prompts.map(async (prompt) => {
      // Step 1: Query with grounding
      const { text, citations } = await queryWithGrounding(prompt.query);

      // Step 2: Extract brands
      const brandData = await extractBrands(text || "", prompt.query, targetBrand);

      return {
        query: prompt.query,
        stage: prompt.stage,
        response: text,
        citations,
        brands: brandData.brands,
        targetBrandFound: brandData.target_brand_found,
        targetBrandMentions: brandData.target_brand_mentions,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<PromptResult> => r.status === 'fulfilled')
    .map(r => r.value);
}

export function calculateScores(results: PromptResult[], targetBrand: string) {
  const totalPrompts = results.length;
  const promptsWithBrand = results.filter(r => r.targetBrandFound).length;

  // Visibility: in how many prompts was the brand mentioned
  const visibilityScore = (promptsWithBrand / totalPrompts) * 100;

  // Market share: brand mentions vs total mentions
  const allBrands: Record<string, number> = {};
  results.forEach(r => {
    r.brands.forEach(b => {
      const name = b.name.toLowerCase();
      allBrands[name] = (allBrands[name] || 0) + b.mentions;
    });
  });

  const totalMentions = Object.values(allBrands).reduce((a, b) => a + b, 0);
  const targetMentions = allBrands[targetBrand.toLowerCase()] || 0;
  const marketShare = totalMentions > 0 
    ? (targetMentions / totalMentions) * 100 
    : 0;

  // Citation domains
  const citationDomains: Record<string, number> = {};
  results.forEach(r => {
    r.citations.forEach(c => {
      if (c.domain) {
        citationDomains[c.domain] = (citationDomains[c.domain] || 0) + 1;
      }
    });
  });

  // Sort brands by mentions
  const brandRanking = Object.entries(allBrands)
    .map(([name, mentions]) => ({ name, mentions, share: (mentions / totalMentions) * 100 }))
    .sort((a, b) => b.mentions - a.mentions);

  return {
    visibilityScore,
    marketShare,
    totalPrompts,
    promptsWithBrand,
    brandRanking,
    citationDomains: Object.entries(citationDomains)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count),
    perPromptResults: results,
  };
}