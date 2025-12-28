'use client';

import { useState, useCallback } from 'react';

interface SocialShareButtonsProps {
  /** URL to share (defaults to current page) */
  url?: string;
  /** Title/text to share */
  title: string;
  /** Product ID for tracking */
  productId?: string;
  /** Compact mode (icons only) */
  compact?: boolean;
}

/**
 * Social share buttons for product pages
 * Supports Twitter/X, LINE, Copy URL
 *
 * Colors are managed via CSS variables in shared.css:
 * - --social-line-bg, --social-line-hover
 * - --social-twitter-bg, --social-twitter-hover, --social-twitter-text, --social-twitter-border
 * - --social-copy-bg, --social-copy-hover, --social-copy-text, --social-copy-border
 * - --social-copy-success-bg, --social-copy-success-text, --social-copy-success-border
 */
export function SocialShareButtons({
  url,
  title,
  compact = false,
}: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  // Use current URL if not provided
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [shareUrl]);

  const buttonBaseClass = 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all';
  const iconSize = 'w-4 h-4';
  const textClass = compact ? 'hidden' : 'text-xs font-medium';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Twitter/X */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonBaseClass}
        style={{
          backgroundColor: 'var(--social-twitter-bg)',
          color: 'var(--social-twitter-text)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--social-twitter-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--social-twitter-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--social-twitter-bg)';
        }}
        title="X (Twitter)でシェア"
      >
        <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span className={textClass}>X</span>
      </a>

      {/* LINE - Brand color is consistent across themes */}
      <a
        href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonBaseClass}
        style={{
          backgroundColor: 'var(--social-line-bg)',
          color: '#ffffff',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--social-line-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--social-line-bg)';
        }}
        title="LINEでシェア"
      >
        <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
        <span className={textClass}>LINE</span>
      </a>

      {/* Copy URL */}
      <button
        onClick={handleCopy}
        className={buttonBaseClass}
        style={{
          backgroundColor: copied ? 'var(--social-copy-success-bg)' : 'var(--social-copy-bg)',
          color: copied ? 'var(--social-copy-success-text)' : 'var(--social-copy-text)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: copied ? 'var(--social-copy-success-border)' : 'var(--social-copy-border)',
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            e.currentTarget.style.backgroundColor = 'var(--social-copy-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (!copied) {
            e.currentTarget.style.backgroundColor = 'var(--social-copy-bg)';
          }
        }}
        title="URLをコピー"
        type="button"
      >
        {copied ? (
          <>
            <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className={textClass}>コピー済</span>
          </>
        ) : (
          <>
            <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span className={textClass}>URL</span>
          </>
        )}
      </button>
    </div>
  );
}

export default SocialShareButtons;
