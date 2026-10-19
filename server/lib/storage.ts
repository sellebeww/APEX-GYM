import fs from 'node:fs';
import path from 'node:path';
import { randomToken } from './crypto.ts';

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Identify an image from its magic bytes; the client-supplied type and file name are never trusted. */
export function sniffImage(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Removes APPn metadata segments (EXIF incl. GPS location, XMP, maker notes) and comments from a JPEG,
 * keeping APP0 (JFIF) and APP14 (Adobe colour transform). Returns null if the stream is malformed.
 */
export function stripJpegMetadata(buf: Buffer): Buffer | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd9) {
      out.push(buf.subarray(i, i + 2));
      return Buffer.concat(out);
    }
    if (marker === 0xda) {
      // Start of scan: the rest is entropy-coded image data
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    const isAppN = marker >= 0xe1 && marker <= 0xef && marker !== 0xee;
    const isComment = marker === 0xfe;
    if (!isAppN && !isComment) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

export interface PhotoStorage {
  save(data: Buffer, mime: ImageMime): string;
  read(key: string): Buffer | null;
  remove(key: string): void;
}

const EXT: Record<ImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const KEY_RE = /^[A-Za-z0-9_-]{20,64}\.(jpg|png|webp)$/;

/** Local-disk storage outside the web root; files are only served through an authorised API route. */
export function diskStorage(dir: string): PhotoStorage {
  fs.mkdirSync(dir, { recursive: true });
  return {
    save(data, mime) {
      const key = `${randomToken(24)}.${EXT[mime]}`;
      fs.writeFileSync(path.join(dir, key), data, { flag: 'wx', mode: 0o600 });
      return key;
    },
    read(key) {
      if (!KEY_RE.test(key)) return null;
      try {
        return fs.readFileSync(path.join(dir, key));
      } catch {
        return null;
      }
    },
    remove(key) {
      if (!KEY_RE.test(key)) return;
      fs.rmSync(path.join(dir, key), { force: true });
    },
  };
}

export function memoryStorage(): PhotoStorage {
  const files = new Map<string, Buffer>();
  return {
    save(data, mime) {
      const key = `${randomToken(24)}.${EXT[mime]}`;
      files.set(key, data);
      return key;
    },
    read: key => files.get(key) ?? null,
    remove: key => void files.delete(key),
  };
}
