export interface WebsiteAnalysis {
  brand_name: string;
  description: string;
  target_audience: string;
  industry: string;
  key_features: string[];
  prompts: AnalysisPrompt[];
}

export interface AnalysisPrompt {
  stage: string;
  query: string;
}

export interface Citation {
  url: string;
  title: string;
  domain: string | null;
}

export interface GroundedResponse {
  text: string;
  citations: Citation[];
}

export interface BrandExtraction {
  brands: BrandMention[];
  target_brand_found: boolean;
  target_brand_mentions: number;
}

export interface BrandMention {
  name: string;
  mentions: number;
  context?: string;
}

export interface PromptResult {
  query: string;
  stage: string;
  response: string;
  citations: Citation[];
  brands: BrandMention[];
  targetBrandFound: boolean;
  targetBrandMentions: number;
}

export interface BrandRanking {
  name: string;
  mentions: number;
  share: number;
}

export interface DomainCount {
  domain: string;
  count: number;
}

export interface LlmScores {
  llm: 'gemini' | 'chatgpt';
  visibilityScore: number;
  marketShare: number;
  totalPrompts: number;
  promptsWithBrand: number;
  brandRanking: BrandRanking[];
  citationDomains: DomainCount[];
  perPromptResults: PromptResult[];
}

export interface AnalysisScores {
  overallVisibilityScore: number;
  comparison: {
    gemini: { visibilityScore: number; marketShare: number };
    chatgpt: { visibilityScore: number; marketShare: number };
  };
  totalPromptsAnalyzed: number;
  gemini: LlmScores;
  chatgpt: LlmScores;
  combinedBrandRanking: BrandRanking[];
  combinedCitationDomains: DomainCount[];
}

export interface SseEvent {
  type: 'progress' | 'result' | 'error';
  stage?: string;
  data?: AnalysisScores;
  message?: string;
}
