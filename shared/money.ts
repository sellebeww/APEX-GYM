/**
 * Money is always an integer number of rupiah (IDR has no minor unit in practice).
 * Sums of integers below 2^53 are exact, so no floating-point drift is possible.
 */
export function assertRupiah(n: unknown): asserts n is number {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
    throw new Error(`Invalid rupiah amount: ${String(n)}`);
  }
}

export const sumRupiah = (values: number[]) => values.reduce((s, v) => s + v, 0);

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

/** Compact IDR: 1.250.000 -> "1,3 jt" */
export const rupiahCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(Math.round(n));
};
