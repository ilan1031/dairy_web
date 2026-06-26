'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const RunningCowScene = dynamic(() => import('./RunningCowScene'), {
  ssr: false,
  loading: () => (
    <div
      className="cow-loading-fallback"
      style={{ width: '100%', height: '100%', borderRadius: '50%' }}
    />
  ),
});

export type CowLoadingSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<CowLoadingSize, number> = {
  xs: 40,
  sm: 72,
  md: 120,
  lg: 200,
};

interface CowLoadingProps {
  message?: string;
  size?: CowLoadingSize;
  fullScreen?: boolean;
  inline?: boolean;
  className?: string;
  messageStyle?: React.CSSProperties;
}

export default function CowLoading({
  message,
  size = 'md',
  fullScreen = false,
  inline = false,
  className,
  messageStyle,
}: CowLoadingProps) {
  const cowSize = SIZE_MAP[size];

  const content = (
    <div
      className={`cow-loading ${inline ? 'cow-loading--inline' : ''} ${className ?? ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <RunningCowScene size={cowSize} />
      {message && (
        <p className="cow-loading__message" style={messageStyle}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="cow-loading--fullscreen">
        {content}
      </div>
    );
  }

  return content;
}

export function CowLoadingInline({ message }: { message?: string }) {
  return <CowLoading size="xs" inline message={message} />;
}
