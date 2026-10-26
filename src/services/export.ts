import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { external } from '@/store/session';
import { useData } from '@/store/data';
import { bytesToBase64 } from '@/utils/base64';
import { formatDateTime } from '@/utils/date';
import { toHtml, toPlain } from '@/utils/markdown';
import type { Note } from '@/types';

export type ExportFormat = 'pdf' | 'md' | 'txt' | 'html';

export const FORMAT_INFO: Record<ExportFormat, { label: string; ext: string; mime: string; uti: string }> = {
  pdf: { label: 'PDF document', ext: 'pdf', mime: 'application/pdf', uti: 'com.adobe.pdf' },
  md: { label: 'Markdown', ext: 'md', mime: 'text/markdown', uti: 'net.daringfireball.markdown' },
  txt: { label: 'Plain text', ext: 'txt', mime: 'text/plain', uti: 'public.plain-text' },
  html: { label: 'Web page', ext: 'html', mime: 'text/html', uti: 'public.html' },
};

const safeName = (s: string) => (s.trim() || 'Untitled note').replace(/[^\w\- ]+/g, '').trim().slice(0, 48) || 'note';

export function noteAsText(note: Note): string {
  const head = note.title.trim() ? `${note.title.trim()}\n\n` : '';
  return `${head}${toPlain(note.body)}`.trim();
}

async function imageDataUri(uri: string): Promise<string | null> {
  try {
    const f = new File(uri);
    if (!f.exists) return null;
    const ext = /\.([a-z0-9]+)$/i.exec(uri)?.[1]?.toLowerCase() ?? 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${bytesToBase64(await f.bytes())}`;
  } catch {
    return null;
  }
}

async function buildHtml(note: Note, categoryName: string | null): Promise<string> {
  const images: string[] = [];
  for (const a of note.attachments.filter((x) => x.type === 'image')) {
    const d = await imageDataUri(a.uri);
    if (d) images.push(`<img src="${d}" />`);
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(note.title || 'Untitled note')}</title>
<style>
 body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;padding:32px;max-width:720px;margin:auto;line-height:1.55}
 .brand{display:inline-block;background:#FFD400;border:2px solid #111;padding:2px 10px;font-weight:800;font-size:12px;letter-spacing:1px;box-shadow:3px 3px 0 #111}
 h1{font-size:30px;margin:18px 0 4px} .meta{color:#6f6a58;font-size:12px;margin-bottom:22px}
 mark{background:#FFE45C} blockquote{border-left:4px solid #FFD400;margin:12px 0;padding:2px 14px;color:#444}
 code,pre{background:#f4efd8;border-radius:6px;padding:2px 6px;font-family:Menlo,monospace} pre{padding:12px;white-space:pre-wrap}
 img{max-width:100%;border:2px solid #111;border-radius:12px;margin:10px 0;display:block}
 li.chk{list-style:none;margin-left:-20px}
</style></head><body>
<span class="brand">NIVORA NOTES</span>
<h1>${esc(note.title || 'Untitled note')}</h1>
<div class="meta">${categoryName ? esc(categoryName) + ' · ' : ''}Updated ${formatDateTime(note.updatedAt)}${note.tags.length ? ' · ' + note.tags.map((t) => '#' + esc(t)).join(' ') : ''}</div>
${toHtml(note.body)}
${images.join('\n')}
</body></html>`;
}

export async function exportNote(note: Note, format: ExportFormat): Promise<string> {
  const info = FORMAT_INFO[format];
  const cat = useData.getState().categories.find((c) => c.id === note.categoryId)?.name ?? null;
  const base = safeName(note.title);
  if (format === 'pdf') {
    const html = await buildHtml(note, cat);
    const res = await Print.printToFileAsync({ html, base64: false });
    const dest = new File(Paths.cache, `${base}.pdf`);
    if (dest.exists) dest.delete();
    new File(res.uri).copy(dest);
    return dest.uri;
  }
  const dest = new File(Paths.cache, `${base}.${info.ext}`);
  dest.create({ overwrite: true });
  if (format === 'html') dest.write(await buildHtml(note, cat));
  else if (format === 'md') dest.write(`${note.title ? `# ${note.title}\n\n` : ''}${note.body}\n`);
  else dest.write(noteAsText(note) + '\n');
  return dest.uri;
}

export async function shareFile(uri: string, format: ExportFormat): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  const info = FORMAT_INFO[format];
  await external(() => Sharing.shareAsync(uri, { mimeType: info.mime, dialogTitle: 'Share note', UTI: info.uti }));
}

export async function shareText(note: Note): Promise<boolean> {
  const res = await external(() => Share.share({ title: note.title || 'Nivora note', message: noteAsText(note) }));
  const ok = res.action === Share.sharedAction;
  if (ok) useData.getState().logShare(note.id, 'text');
  return ok;
}

export async function copyText(note: Note): Promise<void> {
  await Clipboard.setStringAsync(noteAsText(note));
  useData.getState().logShare(note.id, 'copy');
}

export async function printNote(note: Note): Promise<void> {
  const cat = useData.getState().categories.find((c) => c.id === note.categoryId)?.name ?? null;
  const html = await buildHtml(note, cat);
  await external(() => Print.printAsync({ html }));
}
