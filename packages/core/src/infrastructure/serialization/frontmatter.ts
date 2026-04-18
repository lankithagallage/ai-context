import matter from 'gray-matter';

export function serializeMarkdown(data: Record<string, unknown>, body: string): string {
  return matter.stringify(body.trim() + '\n', data);
}

export function parseMarkdown<T extends Record<string, unknown>>(source: string): {
  data: T;
  content: string;
} {
  const parsed = matter(source);
  return { data: parsed.data as T, content: parsed.content };
}
