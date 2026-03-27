export function normalizeMarkdown(
  raw: string,
  maxChars: number = 3000,
): string {
  let text = raw.split('Markdown Content:')[1] || raw;

  text = text.replace(/!\[.*?\]\(.*?\)/g, '');
  text = text.replace(/\[([^\]]+)\]\(.*?\)/g, '$1');
  text = text.replace(/https?:\/\/\S+/g, '');
  text = text.replace(/^[-*]\s*.{1,30}$/gm, '');

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

  text = text.replace(/^#{1,6}\s*$/gm, '');
  text = text.replace(/^---+$/gm, '');
  text = text.replace(/\*\*/g, '');
  text = text.replace(/\*/g, '');

  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  if (text.length > maxChars) {
    text = text.substring(0, maxChars);
    const lastSentence = text.lastIndexOf('.');
    if (lastSentence > maxChars * 0.7) {
      text = text.substring(0, lastSentence + 1);
    }
  }

  return text;
}
