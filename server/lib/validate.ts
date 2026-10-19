import { z } from 'zod';
import { isDateKey, isTimeKey } from '../../shared/time.ts';
import type { Ctx } from '../context.ts';
import { badRequest } from './errors.ts';

/** Parses the JSON body against a schema; the first issue becomes a readable 400 message. */
export async function body<T extends z.ZodType>(c: Ctx, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest('Format permintaan tidak valid (JSON diperlukan).');
  }
  return parse(schema, raw);
}

export function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw badRequest(`Input tidak valid. ${where}${issue.message}`, 'VALIDATION');
  }
  return result.data;
}

/** Trimmed text with length bounds; control characters (except newlines/tabs) are rejected. */
export const text = (min: number, max: number) =>
  z
    .string()
    .transform(s => s.trim())
    .pipe(
      z
        .string()
        .min(min, min > 0 ? `minimal ${min} karakter` : undefined)
        .max(max, `maksimal ${max} karakter`)
        // eslint-disable-next-line no-control-regex
        .refine(s => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s), 'mengandung karakter tidak valid')
    );

export const dateKey = z.string().refine(isDateKey, 'tanggal harus berformat YYYY-MM-DD');
export const timeKey = z.string().refine(isTimeKey, 'jam harus berformat HH:MM');
export const id = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/, 'ID tidak valid');
export const email = z
  .string()
  .transform(s => s.trim().toLowerCase())
  .pipe(z.string().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'alamat email tidak valid'));
export const phone = z
  .string()
  .transform(s => s.trim())
  .refine(s => /^[+\d][\d\s-]{7,20}$/.test(s), 'nomor telepon tidak valid')
  .refine(s => {
    const d = s.replace(/\D/g, '');
    return d.length >= 9 && d.length <= 15;
  }, 'nomor telepon harus 9-15 digit');
export const password = z
  .string()
  .min(10, 'password minimal 10 karakter')
  .max(200, 'password terlalu panjang')
  .refine(s => /[A-Za-z]/.test(s) && /\d/.test(s), 'password harus berisi huruf dan angka');
export const version = z.number().int().positive().optional();
export const rupiahAmount = z.number().int('nominal harus bilangan bulat rupiah').positive().max(10_000_000_000);
