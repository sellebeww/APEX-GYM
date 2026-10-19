/** Thin client for the APEX API: same-origin cookies, CSRF header, timeouts and readable errors. */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const NETWORK_MESSAGE = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.';

export async function api<T = { ok: boolean; message?: string }>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(method === 'GET' ? {} : { 'X-APEX-CSRF': '1' }),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(20_000) : undefined,
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new ApiError(timedOut ? 'Server terlalu lama merespons. Coba lagi.' : NETWORK_MESSAGE, 0, 'NETWORK');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(e?.message ?? `Permintaan gagal (${res.status}).`, res.status, e?.code ?? 'HTTP_ERROR');
  }
  return data as T;
}
