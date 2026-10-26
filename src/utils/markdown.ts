export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  hl?: boolean;
  code?: boolean;
  underline?: boolean;
}

export type Block =
  | { type: 'h'; level: 1 | 2 | 3; inline: Inline[]; line: number }
  | { type: 'p'; inline: Inline[]; line: number }
  | { type: 'bullet'; inline: Inline[]; line: number; indent: number }
  | { type: 'num'; n: string; inline: Inline[]; line: number; indent: number }
  | { type: 'check'; checked: boolean; inline: Inline[]; line: number; indent: number }
  | { type: 'quote'; inline: Inline[]; line: number }
  | { type: 'code'; text: string; line: number }
  | { type: 'hr'; line: number }
  | { type: 'blank'; line: number };

const INLINE_RE = /\*\*(.+?)\*\*|~~(.+?)~~|==(.+?)==|\+\+(.+?)\+\+|`([^`]+)`|\*([^*\n]+?)\*/;

export function parseInline(src: string, base: Omit<Inline, 'text'> = {}): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest);
    if (!m) {
      out.push({ ...base, text: rest });
      break;
    }
    if (m.index > 0) out.push({ ...base, text: rest.slice(0, m.index) });
    if (m[1] !== undefined) out.push(...parseInline(m[1], { ...base, bold: true }));
    else if (m[2] !== undefined) out.push(...parseInline(m[2], { ...base, strike: true }));
    else if (m[3] !== undefined) out.push(...parseInline(m[3], { ...base, hl: true }));
    else if (m[4] !== undefined) out.push(...parseInline(m[4], { ...base, underline: true }));
    else if (m[5] !== undefined) out.push({ ...base, code: true, text: m[5] });
    else if (m[6] !== undefined) out.push(...parseInline(m[6], { ...base, italic: true }));
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const RE_H = /^(#{1,3})\s+(.*)$/;
const RE_CHECK = /^(\s*)[-*•]\s+\[( |x|X)\]\s?(.*)$/;
const RE_BULLET = /^(\s*)[-*•]\s+(.*)$/;
const RE_NUM = /^(\s*)(\d+)\.\s+(.*)$/;
const RE_QUOTE = /^>\s?(.*)$/;
const RE_HR = /^(-{3,}|\*{3,}|_{3,})\s*$/;

export function parseBlocks(body: string): Block[] {
  const lines = body.split('\n');
  const blocks: Block[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let codeStart = 0;
  lines.forEach((raw, i) => {
    if (raw.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', text: codeBuf.join('\n'), line: codeStart });
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
        codeStart = i;
      }
      return;
    }
    if (inCode) {
      codeBuf.push(raw);
      return;
    }
    if (raw.trim() === '') {
      blocks.push({ type: 'blank', line: i });
      return;
    }
    let m: RegExpExecArray | null;
    if ((m = RE_HR.exec(raw))) {
      blocks.push({ type: 'hr', line: i });
    } else if ((m = RE_H.exec(raw))) {
      blocks.push({ type: 'h', level: m[1].length as 1 | 2 | 3, inline: parseInline(m[2]), line: i });
    } else if ((m = RE_CHECK.exec(raw))) {
      blocks.push({
        type: 'check',
        checked: m[2].toLowerCase() === 'x',
        inline: parseInline(m[3]),
        line: i,
        indent: Math.floor(m[1].length / 2),
      });
    } else if ((m = RE_BULLET.exec(raw))) {
      blocks.push({ type: 'bullet', inline: parseInline(m[2]), line: i, indent: Math.floor(m[1].length / 2) });
    } else if ((m = RE_NUM.exec(raw))) {
      blocks.push({ type: 'num', n: m[2], inline: parseInline(m[3]), line: i, indent: Math.floor(m[1].length / 2) });
    } else if ((m = RE_QUOTE.exec(raw))) {
      blocks.push({ type: 'quote', inline: parseInline(m[1]), line: i });
    } else {
      blocks.push({ type: 'p', inline: parseInline(raw), line: i });
    }
  });
  if (inCode) blocks.push({ type: 'code', text: codeBuf.join('\n'), line: codeStart });
  return blocks;
}

/** Flip a "- [ ]" / "- [x]" line. */
export function toggleCheckLine(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  const l = lines[lineIndex];
  if (l === undefined) return body;
  if (/\[ \]/.test(l)) lines[lineIndex] = l.replace('[ ]', '[x]');
  else if (/\[[xX]\]/.test(l)) lines[lineIndex] = l.replace(/\[[xX]\]/, '[ ]');
  return lines.join('\n');
}

export function inlineToPlain(inline: Inline[]): string {
  return inline.map((i) => i.text).join('');
}

/** Readable plain text (used for card previews, search and .txt export). */
export function toPlain(body: string): string {
  return parseBlocks(body)
    .map((b) => {
      switch (b.type) {
        case 'h':
        case 'p':
        case 'quote':
          return inlineToPlain(b.inline);
        case 'bullet':
          return '  '.repeat(b.indent) + '• ' + inlineToPlain(b.inline);
        case 'num':
          return '  '.repeat(b.indent) + b.n + '. ' + inlineToPlain(b.inline);
        case 'check':
          return '  '.repeat(b.indent) + (b.checked ? '☑ ' : '☐ ') + inlineToPlain(b.inline);
        case 'code':
          return b.text;
        case 'hr':
          return '────────';
        default:
          return '';
      }
    })
    .join('\n');
}

export function preview(body: string, maxLines = 4): string {
  const lines = toPlain(body)
    .split('\n')
    .filter((l) => l.trim().length > 0);
  return lines.slice(0, maxLines).join('\n');
}

export function wordCount(body: string): number {
  const t = toPlain(body).trim();
  return t ? t.split(/\s+/).length : 0;
}

export function checklistProgress(body: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  parseBlocks(body).forEach((b) => {
    if (b.type === 'check') {
      total += 1;
      if (b.checked) done += 1;
    }
  });
  return { done, total };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineToHtml(inline: Inline[]): string {
  return inline
    .map((i) => {
      let s = escapeHtml(i.text);
      if (i.code) s = `<code>${s}</code>`;
      if (i.bold) s = `<strong>${s}</strong>`;
      if (i.italic) s = `<em>${s}</em>`;
      if (i.underline) s = `<u>${s}</u>`;
      if (i.strike) s = `<s>${s}</s>`;
      if (i.hl) s = `<mark>${s}</mark>`;
      return s;
    })
    .join('');
}

export function toHtml(body: string): string {
  const blocks = parseBlocks(body);
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  blocks.forEach((b) => {
    if (b.type === 'bullet' || b.type === 'check') {
      if (list !== 'ul') {
        close();
        out.push('<ul>');
        list = 'ul';
      }
      if (b.type === 'check') out.push(`<li class="chk">${b.checked ? '☑' : '☐'} ${inlineToHtml(b.inline)}</li>`);
      else out.push(`<li>${inlineToHtml(b.inline)}</li>`);
      return;
    }
    if (b.type === 'num') {
      if (list !== 'ol') {
        close();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inlineToHtml(b.inline)}</li>`);
      return;
    }
    close();
    if (b.type === 'h') out.push(`<h${b.level + 1}>${inlineToHtml(b.inline)}</h${b.level + 1}>`);
    else if (b.type === 'p') out.push(`<p>${inlineToHtml(b.inline)}</p>`);
    else if (b.type === 'quote') out.push(`<blockquote>${inlineToHtml(b.inline)}</blockquote>`);
    else if (b.type === 'code') out.push(`<pre>${escapeHtml(b.text)}</pre>`);
    else if (b.type === 'hr') out.push('<hr/>');
  });
  close();
  return out.join('\n');
}
