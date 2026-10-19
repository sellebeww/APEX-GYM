import jsqr from 'jsqr';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { signQrToken, verifyQrToken } from '../../server/lib/qr.ts';

// jsqr is CJS; NodeNext typing sees the module namespace, vitest's interop hands us the function itself
const jsQR = jsqr as unknown as (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

const SECRET = 'test-secret-'.padEnd(48, 'x');

/** Renders a QR as an RGBA bitmap, the same shape of data the scanner reads from a camera frame. */
function render(text: string, scale = 6, margin = 4) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = (modules.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin;
      const my = Math.floor(y / scale) - margin;
      if (mx >= 0 && my >= 0 && mx < modules.size && my < modules.size && modules.get(mx, my)) {
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, size };
}

describe('scanner fallback (jsQR) for browsers without BarcodeDetector, e.g. iOS Safari', () => {
  it('decodes a signed member QR token exactly, and the server still accepts it', () => {
    const { token } = signQrToken(SECRET, 'member-test', 60);
    const { data, size } = render(token);
    const decoded = jsQR(data, size, size)?.data;
    expect(decoded).toBe(token);
    expect(verifyQrToken(SECRET, decoded ?? '').ok).toBe(true);
  });
});
