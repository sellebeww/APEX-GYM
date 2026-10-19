import { describe, expect, it } from 'vitest';
import { isAnnouncementVisible } from '../announcements';
import type { Announcement } from '../../types';

const ann = (over: Partial<Announcement>): Announcement => ({
  id: 'a', title: 't', content: 'c', type: 'INFO', targetRole: 'ALL', startDate: '2026-10-01', endDate: '2026-10-31',
  isPinned: false, isPublished: true, version: 1, ...over,
});
const day = new Date('2026-10-14T12:00:00');

describe('announcement visibility', () => {
  it('requires publication and the date window', () => {
    expect(isAnnouncementVisible(ann({}), 'PUBLIC', day)).toBe(true);
    expect(isAnnouncementVisible(ann({ isPublished: false }), 'PUBLIC', day)).toBe(false);
    expect(isAnnouncementVisible(ann({ startDate: '2026-10-20' }), 'PUBLIC', day)).toBe(false);
    expect(isAnnouncementVisible(ann({ endDate: '2026-10-13' }), 'PUBLIC', day)).toBe(false);
  });

  it('respects the target audience', () => {
    const memberOnly = ann({ targetRole: 'MEMBER' });
    expect(isAnnouncementVisible(memberOnly, 'PUBLIC', day)).toBe(false);
    expect(isAnnouncementVisible(memberOnly, 'MEMBER', day)).toBe(true);
    expect(isAnnouncementVisible(ann({ targetRole: 'COACH' }), 'MEMBER', day)).toBe(false);
  });
});
