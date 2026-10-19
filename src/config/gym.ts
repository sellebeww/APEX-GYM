/** Single source of truth for gym facts that appear in several places. */
export const GYM_NAME = 'APEX Gym';
export const GYM_LEGAL_NAME = 'PT APEX Kebugaran Nusantara';

/** Maximum comfortable headcount used for the live occupancy percentage */
export const GYM_CAPACITY = 100;

export const GYM_CONTACT = {
  address: 'Jl. Puri Indah Raya Blok A3 No. 12, Kembangan, Jakarta Barat 11610',
  whatsappIntl: '6281288009911',
  whatsappDisplay: '+62 812-8800-9911',
} as const;

/** Hourly slots offered for 1-on-1 personal training sessions (WIB) */
export const PT_SLOT_TIMES = ['07:00', '09:00', '11:00', '14:00', '16:00', '18:00', '19:30'] as const;

/** Sessions cancelled by a member less than this many hours ahead forfeit their credit */
export const PT_CANCEL_WINDOW_HOURS = 12;
