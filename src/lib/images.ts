import { IMAGES } from '../assets/images';

/**
 * The API stores bundled artwork as "asset:<key>" so the database never contains build-specific hashed paths.
 * Anything else must be a same-origin path (CSP blocks third-party images).
 */
export function resolveImage(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('asset:')) return IMAGES[url.slice(6) as keyof typeof IMAGES];
  return url.startsWith('/') ? url : undefined;
}
