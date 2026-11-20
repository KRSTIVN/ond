export type InlineNode =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'bold'; readonly children: readonly InlineNode[] }
  | { readonly type: 'italic'; readonly children: readonly InlineNode[] }
  | { readonly type: 'strike'; readonly children: readonly InlineNode[] }
  | { readonly type: 'code'; readonly code: string }
  | { readonly type: 'link'; readonly label: string; readonly href: string };

export interface ChecklistItem {
  readonly lineIndex: number;
  readonly checked: boolean;
  readonly children: readonly InlineNode[];
}

export type BlockNode =
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3; readonly children: readonly InlineNode[] }
  | { readonly type: 'paragraph'; readonly children: readonly InlineNode[] }
  | { readonly type: 'code_block'; readonly language: string; readonly code: string }
  | { readonly type: 'blockquote'; readonly children: readonly InlineNode[] }
  | { readonly type: 'unordered_list'; readonly items: readonly (readonly InlineNode[])[] }
  | { readonly type: 'ordered_list'; readonly items: readonly (readonly InlineNode[])[] }
  | { readonly type: 'checklist'; readonly items: readonly ChecklistItem[] }
  | { readonly type: 'hr' };

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

export function sanitizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function matchMarkdownLink(rest: string): { label: string; url: string; length: number } | null {
  if (!rest.startsWith('[')) return null;
  const closeBracket = rest.indexOf(']');
  if (closeBracket <= 1 || rest[closeBracket + 1] !== '(') return null;

  let depth = 1;
  let pos = closeBracket + 2;
  while (pos < rest.length && depth > 0) {
    if (rest[pos] === '(') depth += 1;
    else if (rest[pos] === ')') depth -= 1;
    pos += 1;
  }
  if (depth !== 0) return null;

  return {
    label: rest.slice(1, closeBracket),
    url: rest.slice(closeBracket + 2, pos - 1),
    length: pos,
  };
}

export function parseInlineMarkdown(input: string): readonly InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const rest = input.slice(cursor);

    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push({ type: 'code', code: codeMatch[1]! });
      cursor += codeMatch[0].length;
      continue;
    }

    const linkMatch = matchMarkdownLink(rest);
    if (linkMatch) {
      const safeHref = sanitizeLinkUrl(linkMatch.url);
      if (safeHref) {
        nodes.push({ type: 'link', label: linkMatch.label, href: safeHref });
      } else {
        nodes.push({ type: 'text', text: linkMatch.label });
      }
      cursor += linkMatch.length;
      continue;
    }

    const boldMatch = rest.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      nodes.push({ type: 'bold', children: parseInlineMarkdown(boldMatch[1]!) });
      cursor += boldMatch[0].length;
      continue;
    }

    const strikeMatch = rest.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      nodes.push({ type: 'strike', children: parseInlineMarkdown(strikeMatch[1]!) });
      cursor += strikeMatch[0].length;
      continue;
    }

    const italicMatch = rest.match(/^\*([^*]+?)\*/);
    if (italicMatch) {
      nodes.push({ type: 'italic', children: parseInlineMarkdown(italicMatch[1]!) });
      cursor += italicMatch[0].length;
      continue;
    }

    const nextSpecial = rest.slice(1).search(/[`[*~]/);
    const step = nextSpecial === -1 ? rest.length : nextSpecial + 1;
    nodes.push({ type: 'text', text: rest.slice(0, step) });
    cursor += step;
  }

  return nodes;
}

function isBlockBoundary(line: string): boolean {
  if (line.trim() === '') return true;
  if (line.startsWith('```') || line.startsWith('> ')) return true;
  if (/^(#{1,3})\s+/.test(line)) return true;
  if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) return true;
  if (/^\s*([-*]|\d+\.)\s+/.test(line)) return true;
  return false;
}

export function parseMarkdownAst(source: string): readonly BlockNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx]!;
    if (line.trim() === '') {
      idx += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      idx += 1;
      while (idx < lines.length && !lines[idx]!.startsWith('```')) {
        codeLines.push(lines[idx]!);
        idx += 1;
      }
      if (idx < lines.length) idx += 1;
      blocks.push({ type: 'code_block', language, code: codeLines.join('\n') });
      continue;
    }

    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      idx += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInlineMarkdown(headingMatch[2]!) });
      idx += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (idx < lines.length && lines[idx]!.startsWith('> ')) {
        quoteLines.push(lines[idx]!.slice(2));
        idx += 1;
      }
      blocks.push({
        type: 'blockquote',
        children: parseInlineMarkdown(quoteLines.join(' ')),
      });
      continue;
    }

    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const items: ChecklistItem[] = [];
      while (idx < lines.length) {
        const match = lines[idx]!.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (!match) break;
        items.push({
          lineIndex: idx,
          checked: match[1]!.toLowerCase() === 'x',
          children: parseInlineMarkdown(match[2]!),
        });
        idx += 1;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: (readonly InlineNode[])[] = [];
      while (idx < lines.length) {
        const match = lines[idx]!.match(/^\s*[-*]\s+(.+)$/);
        if (!match || /^\s*[-*]\s+\[[ xX]\]\s+/.test(lines[idx]!)) break;
        items.push(parseInlineMarkdown(match[1]!));
        idx += 1;
      }
      blocks.push({ type: 'unordered_list', items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: (readonly InlineNode[])[] = [];
      while (idx < lines.length) {
        const match = lines[idx]!.match(/^\s*\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(parseInlineMarkdown(match[1]!));
        idx += 1;
      }
      blocks.push({ type: 'ordered_list', items });
      continue;
    }

    const paraLines: string[] = [];
    while (idx < lines.length && !isBlockBoundary(lines[idx]!)) {
      paraLines.push(lines[idx]!);
      idx += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInlineMarkdown(paraLines.join(' ')) });
  }

  return blocks;
}

export function toggleChecklistAtLine(source: string, lineIndex: number): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const target = lines[lineIndex];
  if (target === undefined) return source;
  const match = target.match(/^(\s*[-*]\s+\[)([ xX])(\]\s+.*)$/);
  if (!match) return source;
  const nextMark = match[2]!.toLowerCase() === 'x' ? ' ' : 'x';
  lines[lineIndex] = `${match[1]}${nextMark}${match[3]}`;
  return lines.join('\n');
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
