import { UserInput } from "@/lib/agents/prompt-enhancer";

export function normalizeUserInput(input: UserInput): string {
  if (!input) return '';

  if (typeof input === 'string') {
    return input.trim();
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item.parts && Array.isArray(item.parts)) return item.parts.join(' ');
        if (item.content) return item.content;
        return '';
      })
      .join('\n')
      .trim();
  }

  if (typeof input === 'object') {
    if (input.parts && Array.isArray(input.parts)) return input.parts.join(' ').trim();
    if (input.content) return input.content.trim();
  }

  return '';
}
