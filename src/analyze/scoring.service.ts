import { Injectable } from '@nestjs/common';

import {
  PromptResult,
  BrandRanking,
  DomainCount,
  LlmScores,
  AnalysisScores,
} from './interfaces/analysis.interface';

@Injectable()
export class ScoringService {
  calculateLlmScores(
    llm: 'gemini' | 'chatgpt',
    results: PromptResult[],
    targetBrand: string,
  ): LlmScores {
    const totalPrompts = results.length;
    const promptsWithBrand = results.filter((r) => r.targetBrandFound).length;
    const visibilityScore =
      totalPrompts > 0 ? (promptsWithBrand / totalPrompts) * 100 : 0;

    const allBrands: Record<string, number> = {};
    for (const result of results) {
      for (const brand of result.brands) {
        const name = brand.name.toLowerCase();
        allBrands[name] = (allBrands[name] || 0) + brand.mentions;
      }
    }

    const totalMentions = Object.values(allBrands).reduce((a, b) => a + b, 0);
    const targetMentions = allBrands[targetBrand.toLowerCase()] || 0;
    const marketShare =
      totalMentions > 0 ? (targetMentions / totalMentions) * 100 : 0;

    const citationDomains: Record<string, number> = {};
    for (const result of results) {
      for (const citation of result.citations) {
        if (citation.domain) {
          citationDomains[citation.domain] =
            (citationDomains[citation.domain] || 0) + 1;
        }
      }
    }

    const brandRanking: BrandRanking[] = Object.entries(allBrands)
      .map(([name, mentions]) => ({
        name,
        mentions,
        share: totalMentions > 0 ? (mentions / totalMentions) * 100 : 0,
      }))
      .sort((a, b) => b.mentions - a.mentions);

    const domainCounts: DomainCount[] = Object.entries(citationDomains)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);

    return {
      llm,
      visibilityScore,
      marketShare,
      totalPrompts,
      promptsWithBrand,
      brandRanking,
      citationDomains: domainCounts,
      perPromptResults: results,
    };
  }

  combineScores(
    geminiScores: LlmScores,
    chatgptScores: LlmScores,
  ): AnalysisScores {
    const overallVisibilityScore =
      (geminiScores.visibilityScore + chatgptScores.visibilityScore) / 2;

    const totalPromptsAnalyzed =
      geminiScores.totalPrompts + chatgptScores.totalPrompts;

    const allBrands: Record<string, number> = {};
    const bothScores: LlmScores[] = [geminiScores, chatgptScores];
    for (const scores of bothScores) {
      for (const brand of scores.brandRanking) {
        allBrands[brand.name] = (allBrands[brand.name] || 0) + brand.mentions;
      }
    }
    const totalMentions = Object.values(allBrands).reduce((a, b) => a + b, 0);
    const combinedBrandRanking: BrandRanking[] = Object.entries(allBrands)
      .map(([name, mentions]) => ({
        name,
        mentions,
        share: totalMentions > 0 ? (mentions / totalMentions) * 100 : 0,
      }))
      .sort((a, b) => b.mentions - a.mentions);

    const allDomains: Record<string, number> = {};
    for (const scores of bothScores) {
      for (const d of scores.citationDomains) {
        allDomains[d.domain] = (allDomains[d.domain] || 0) + d.count;
      }
    }
    const combinedCitationDomains: DomainCount[] = Object.entries(allDomains)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);

    return {
      overallVisibilityScore,
      comparison: {
        gemini: {
          visibilityScore: geminiScores.visibilityScore,
          marketShare: geminiScores.marketShare,
        },
        chatgpt: {
          visibilityScore: chatgptScores.visibilityScore,
          marketShare: chatgptScores.marketShare,
        },
      },
      totalPromptsAnalyzed,
      gemini: geminiScores,
      chatgpt: chatgptScores,
      combinedBrandRanking,
      combinedCitationDomains,
    };
  }
}
