const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    out += CHARS[a >> 2];
    out += CHARS[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < len ? CHARS[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < len ? CHARS[c & 63] : '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = CHARS.indexOf(clean[i]);
    const e2 = CHARS.indexOf(clean[i + 1]);
    const e3 = i + 2 < clean.length ? CHARS.indexOf(clean[i + 2]) : 0;
    const e4 = i + 3 < clean.length ? CHARS.indexOf(clean[i + 3]) : 0;
    if (p < out.length) out[p++] = (e1 << 2) | (e2 >> 4);
    if (p < out.length) out[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < out.length) out[p++] = ((e3 & 3) << 6) | e4;
  }
  return out;
}
