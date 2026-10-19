import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}

/** Round avatar that falls back to the person's initial when the image is missing or fails to load. */
export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 36, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ ...style, fontSize: Math.max(10, size * 0.38) }}
        className={`shrink-0 rounded-full bg-surface-2 border border-line-strong text-zinc-200 font-display font-bold flex items-center justify-center ${className}`}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      style={style}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover bg-surface-2 ${className}`}
    />
  );
};
