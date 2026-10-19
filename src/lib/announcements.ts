import type { Announcement } from '../types/index.ts';
import { toDateKey } from '../../shared/time.ts';

/** An announcement is visible when published, inside its date range, and aimed at the viewer's role. */
export function isAnnouncementVisible(
  a: Pick<Announcement, 'isPublished' | 'startDate' | 'endDate' | 'targetRole'>,
  role: 'PUBLIC' | 'MEMBER' | 'COACH' | 'ADMIN',
  now: Date = new Date()
): boolean {
  if (!a.isPublished) return false;
  const today = toDateKey(now);
  if (a.startDate && today < a.startDate) return false;
  if (a.endDate && today > a.endDate) return false;
  if (a.targetRole === 'ALL') return true;
  // Staff see member-facing news too; the public only sees "ALL"
  if (role === 'PUBLIC') return false;
  return a.targetRole === role || role === 'ADMIN' || (a.targetRole === 'MEMBER' && role === 'COACH');
}
