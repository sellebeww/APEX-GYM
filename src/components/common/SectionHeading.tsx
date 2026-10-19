import React from 'react';
import { motion } from 'motion/react';

interface SectionHeadingProps {
  /** Small index label, e.g. "01" */
  index?: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  /** Right-aligned slot (filters, links) shown beside the heading on wide screens */
  aside?: React.ReactNode;
  className?: string;
}

/** Section title block shared across the public site: "— 01  EYEBROW —" echoes the logo's ruled GYM line. */
export const SectionHeading: React.FC<SectionHeadingProps> = ({
  index,
  eyebrow,
  title,
  description,
  align = 'left',
  aside,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.5 }}
    className={`mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between ${
      align === 'center' ? 'text-center md:flex-col md:items-center md:justify-center' : ''
    } ${className}`}
  >
    <div className={align === 'center' ? 'max-w-3xl mx-auto' : 'max-w-2xl'}>
      <div
        className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400 mb-4 ${
          align === 'center' ? 'justify-center' : ''
        }`}
      >
        <span aria-hidden className="h-px w-8 bg-zinc-600" />
        {index && <span className="font-mono text-white">{index}</span>}
        <span>{eyebrow}</span>
        {align === 'center' && <span aria-hidden className="h-px w-8 bg-zinc-600" />}
      </div>
      <h2 className="text-3xl sm:text-4xl font-extrabold uppercase text-white leading-[1.1]">{title}</h2>
      {description && <p className="text-sm text-zinc-400 leading-relaxed mt-4">{description}</p>}
    </div>
    {aside}
  </motion.div>
);
