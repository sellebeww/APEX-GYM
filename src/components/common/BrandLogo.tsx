import React from 'react';
import { LOGO_MARK, LOGO_APEX } from '../../assets/brand/logoPaths';

export type BrandLogoVariant = 'horizontal' | 'vertical' | 'mark' | 'badge';
export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  className?: string;
  showSubtitle?: boolean;
  subtitleText?: string;
  /** Kept for API compatibility; the logo is a static, single-colour asset. */
  animated?: boolean;
  glow?: boolean;
}

/**
 * The APEX summit mark, vectorised 1:1 from the official artwork.
 * Renders in `currentColor` (white on dark surfaces by default).
 * `sizePx` is the rendered WIDTH of the mark; height follows the artwork ratio.
 */
export const ApexEmblem: React.FC<{
  sizePx: number;
  animated?: boolean;
  glow?: boolean;
  className?: string;
}> = ({ sizePx, className = '' }) => (
  <svg
    width={sizePx}
    height={(sizePx * LOGO_MARK.height) / LOGO_MARK.width}
    viewBox={`0 0 ${LOGO_MARK.width} ${LOGO_MARK.height}`}
    role="img"
    aria-label="APEX Gym"
    className={`shrink-0 text-white ${className}`}
  >
    <path d={LOGO_MARK.d} fill="currentColor" fillRule="evenodd" />
  </svg>
);

/** The APEX wordmark, vectorised 1:1 from the official artwork. */
export const ApexWordmark: React.FC<{ heightPx: number; className?: string }> = ({
  heightPx,
  className = '',
}) => (
  <svg
    height={heightPx}
    width={(heightPx * LOGO_APEX.width) / LOGO_APEX.height}
    viewBox={`0 0 ${LOGO_APEX.width} ${LOGO_APEX.height}`}
    role="img"
    aria-label="APEX"
    className={`shrink-0 text-white ${className}`}
  >
    <path d={LOGO_APEX.d} fill="currentColor" fillRule="evenodd" />
  </svg>
);

const SIZES: Record<BrandLogoSize, { mark: number; word: number; sub: string }> = {
  xs: { mark: 22, word: 9, sub: 'text-[7px] tracking-[0.34em]' },
  sm: { mark: 30, word: 11, sub: 'text-[8px] tracking-[0.36em]' },
  md: { mark: 40, word: 14, sub: 'text-[9px] tracking-[0.38em]' },
  lg: { mark: 56, word: 19, sub: 'text-[10px] tracking-[0.4em]' },
  xl: { mark: 76, word: 26, sub: 'text-xs tracking-[0.42em]' },
  '2xl': { mark: 104, word: 36, sub: 'text-sm tracking-[0.44em]' },
};

/** Flanking-rule subtitle, mirroring the "— G Y M —" line of the logo. */
const Subtitle: React.FC<{ text: string; sizeClass: string; rules?: boolean }> = ({
  text,
  sizeClass,
  rules = true,
}) => (
  <span className={`flex items-center justify-center gap-2.5 font-medium uppercase text-white/80 leading-none ${sizeClass}`}>
    {rules && <span aria-hidden className="h-px w-5 bg-current opacity-70" />}
    <span className="mr-[-0.38em]">{text}</span>
    {rules && <span aria-hidden className="h-px w-5 bg-current opacity-70" />}
  </span>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showSubtitle = true,
  subtitleText = 'GYM',
}) => {
  const s = SIZES[size];

  if (variant === 'mark') {
    return <ApexEmblem sizePx={s.mark} className={className} />;
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface/90 border border-line hover:border-white/40 transition-colors backdrop-blur-md ${className}`}
      >
        <ApexEmblem sizePx={s.mark * 0.6} />
        <ApexWordmark heightPx={Math.max(7, s.word * 0.7)} />
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className={`inline-flex flex-col items-center gap-3 select-none ${className}`}>
        <ApexEmblem sizePx={s.mark * 1.5} />
        <ApexWordmark heightPx={s.word * 1.35} />
        {showSubtitle && <Subtitle text={subtitleText} sizeClass={s.sub} />}
      </div>
    );
  }

  // horizontal lockup (navbar / footer)
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <ApexEmblem sizePx={s.mark} />
      <div className="flex flex-col items-start gap-1.5">
        <ApexWordmark heightPx={s.word} />
        {showSubtitle && <Subtitle text={subtitleText} sizeClass={s.sub} rules={false} />}
      </div>
    </div>
  );
};
