export interface Sel {
  start: number;
  end: number;
}
export interface FormatResult {
  text: string;
  sel: Sel;
}

export type LineKind = 'h1' | 'h2' | 'h3' | 'bullet' | 'num' | 'check' | 'quote';

const STRIP_RE = /^(#{1,3}\s+|\s*[-*•]\s+\[( |x|X)\]\s?|\s*[-*•]\s+|\s*\d+\.\s+|>\s?)/;

function hasKind(line: string, kind: LineKind): boolean {
  switch (kind) {
    case 'h1':
      return /^#\s+/.test(line);
    case 'h2':
      return /^##\s+/.test(line);
    case 'h3':
      return /^###\s+/.test(line);
    case 'bullet':
      return /^\s*[-*•]\s+(?!\[( |x|X)\])/.test(line);
    case 'num':
      return /^\s*\d+\.\s+/.test(line);
    case 'check':
      return /^\s*[-*•]\s+\[( |x|X)\]/.test(line);
    case 'quote':
      return /^>\s?/.test(line);
  }
}

function prefixFor(kind: LineKind, index: number): string {
  switch (kind) {
    case 'h1':
      return '# ';
    case 'h2':
      return '## ';
    case 'h3':
      return '### ';
    case 'bullet':
      return '- ';
    case 'num':
      return `${index + 1}. `;
    case 'check':
      return '- [ ] ';
    case 'quote':
      return '> ';
  }
}

export function wrapSelection(text: string, sel: Sel, left: string, right: string = left): FormatResult {
  const { start, end } = sel;
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (start === end) {
    return {
      text: before + left + right + after,
      sel: { start: start + left.length, end: start + left.length },
    };
  }
  const wrapped = before.endsWith(left) && after.startsWith(right);
  if (wrapped) {
    return {
      text: before.slice(0, before.length - left.length) + selected + after.slice(right.length),
      sel: { start: start - left.length, end: end - left.length },
    };
  }
  if (selected.startsWith(left) && selected.endsWith(right) && selected.length >= left.length + right.length) {
    const inner = selected.slice(left.length, selected.length - right.length);
    return { text: before + inner + after, sel: { start, end: start + inner.length } };
  }
  return {
    text: before + left + selected + right + after,
    sel: { start: start + left.length, end: end + left.length },
  };
}

export function toggleLineKind(text: string, sel: Sel, kind: LineKind): FormatResult {
  const lineStart = text.lastIndexOf('\n', Math.max(0, sel.start - 1)) + 1;
  const nl = text.indexOf('\n', sel.end);
  const lineEnd = nl === -1 ? text.length : nl;
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const allHave = nonEmpty.length > 0 && nonEmpty.every((l) => hasKind(l, kind));
  let n = 0;
  const next = lines.map((l) => {
    const stripped = l.replace(STRIP_RE, '');
    if (allHave) return stripped;
    if (l.trim().length === 0 && lines.length > 1) return l;
    const p = prefixFor(kind, n);
    n += 1;
    return p + stripped;
  });
  const replaced = next.join('\n');
  return {
    text: text.slice(0, lineStart) + replaced + text.slice(lineEnd),
    sel: { start: lineStart, end: lineStart + replaced.length },
  };
}

export function insertSnippet(text: string, sel: Sel, snippet: string): FormatResult {
  const out = text.slice(0, sel.start) + snippet + text.slice(sel.end);
  const pos = sel.start + snippet.length;
  return { text: out, sel: { start: pos, end: pos } };
}

export function indentLines(text: string, sel: Sel, outdent: boolean): FormatResult {
  const lineStart = text.lastIndexOf('\n', Math.max(0, sel.start - 1)) + 1;
  const nl = text.indexOf('\n', sel.end);
  const lineEnd = nl === -1 ? text.length : nl;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const next = lines.map((l) => (outdent ? l.replace(/^ {1,2}/, '') : '  ' + l));
  const replaced = next.join('\n');
  return {
    text: text.slice(0, lineStart) + replaced + text.slice(lineEnd),
    sel: { start: lineStart, end: lineStart + replaced.length },
  };
}

/** When the user presses Enter on a list line, continue the list (or end it on an empty item). */
export function continueList(prev: string, next: string, caret: number): FormatResult | null {
  if (next.length !== prev.length + 1) return null;
  if (next[caret - 1] !== '\n') return null;
  const lineStart = next.lastIndexOf('\n', caret - 2) + 1;
  const prevLine = next.slice(lineStart, caret - 1);
  const check = /^(\s*)[-*•]\s+\[( |x|X)\]\s?(.*)$/.exec(prevLine);
  const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(prevLine);
  const num = /^(\s*)(\d+)\.\s+(.*)$/.exec(prevLine);
  let marker = '';
  let content = '';
  if (check) {
    marker = `${check[1]}- [ ] `;
    content = check[3];
  } else if (bullet) {
    marker = `${bullet[1]}- `;
    content = bullet[2];
  } else if (num) {
    marker = `${num[1]}${parseInt(num[2], 10) + 1}. `;
    content = num[3];
  } else return null;
  if (content.trim().length === 0) {
    // empty item: remove marker, end list
    const cleared = next.slice(0, lineStart) + '\n' + next.slice(caret);
    return { text: cleared, sel: { start: lineStart + 1, end: lineStart + 1 } };
  }
  const out = next.slice(0, caret) + marker + next.slice(caret);
  const pos = caret + marker.length;
  return { text: out, sel: { start: pos, end: pos } };
}
