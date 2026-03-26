export function normalizeMarkdown(raw: string, maxChars: number = 3000): string {
    // Extract content after Jina's metadata header
    let text = raw.split('Markdown Content:')[1] || raw;
  
    // Remove image markdown ![alt](url)
    text = text.replace(/!\[.*?\]\(.*?\)/g, '');
  
    // Keep link text, remove URLs: [text](url) → text
    text = text.replace(/\[([^\]]+)\]\(.*?\)/g, '$1');
  
    // Remove bare URLs
    text = text.replace(/https?:\/\/\S+/g, '');
  
    // Remove nav-style list items (short bullet points that are just links)
    text = text.replace(/^[-*]\s*.{1,30}$/gm, '');
  
    // Remove common junk sections
    const junkPatterns = [
      /skip to.*$/gim,
      /cookie policy.*$/gim,
      /terms of service.*$/gim,
      /privacy policy.*$/gim,
      /all rights reserved.*$/gim,
      /©.*$/gim,
      /follow us on.*$/gim,
      /subscribe to.*newsletter.*$/gim,
    ];
    for (const pattern of junkPatterns) {
      text = text.replace(pattern, '');
    }
  
    // Remove markdown formatting noise
    text = text.replace(/^#{1,6}\s*$/gm, '');     // empty headings
    text = text.replace(/^---+$/gm, '');            // horizontal rules
    text = text.replace(/\*\*/g, '');               // bold markers
    text = text.replace(/\*/g, '');                 // italic markers
  
    // Collapse whitespace
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();
  
    // Truncate smartly
    if (text.length > maxChars) {
      text = text.substring(0, maxChars);
      const lastSentence = text.lastIndexOf('.');
      if (lastSentence > maxChars * 0.7) {
        text = text.substring(0, lastSentence + 1);
      }
    }
  
    return text;
  }


