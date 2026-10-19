/** An error whose message is safe to show to the user. */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg: string, code = 'BAD_REQUEST') => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Silakan masuk terlebih dahulu.') => new HttpError(401, msg, 'UNAUTHENTICATED');
export const forbidden = (msg = 'Anda tidak memiliki akses ke data ini.') => new HttpError(403, msg, 'FORBIDDEN');
export const notFound = (msg = 'Data tidak ditemukan.') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string, code = 'CONFLICT') => new HttpError(409, msg, code);
export const tooMany = (msg = 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.') => new HttpError(429, msg, 'RATE_LIMITED');

/** Optimistic concurrency: reject a write made against a stale copy of the record. */
export function assertVersion(current: number, expected: number | undefined) {
  if (expected !== undefined && current !== expected) {
    throw conflict('Data ini baru saja diubah oleh pengguna lain. Halaman dimuat ulang, periksa lalu ulangi perubahan Anda.', 'STALE_VERSION');
  }
}
