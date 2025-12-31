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
  /** Description for share (optional) */
  description?: string;
  /** Show additional platforms */
  showAll?: boolean;
  /** Hashtags for Twitter (without #) */
  hashtags?: string[];
}

/**
 * Social share buttons for product pages
 * Supports Twitter/X, LINE, Facebook, Reddit, Telegram, Copy URL
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
  description,
  showAll = false,
  hashtags = [],
}: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  // Use current URL if not provided
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || '');
  const hashtagsString = hashtags.length > 0 ? `&hashtags=${hashtags.join(',')}` : '';

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
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}${hashtagsString}`}
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

      {/* Additional platforms (shown when showAll is true) */}
      {showAll && (
        <>
          {/* Facebook */}
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonBaseClass}
            style={{
              backgroundColor: '#1877F2',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#166FE5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1877F2';
            }}
            title="Facebookでシェア"
          >
            <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className={textClass}>Facebook</span>
          </a>

          {/* Reddit */}
          <a
            href={`https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonBaseClass}
            style={{
              backgroundColor: '#FF4500',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#E03D00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FF4500';
            }}
            title="Redditでシェア"
          >
            <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
            </svg>
            <span className={textClass}>Reddit</span>
          </a>

          {/* Telegram */}
          <a
            href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonBaseClass}
            style={{
              backgroundColor: '#0088cc',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0077B5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0088cc';
            }}
            title="Telegramでシェア"
          >
            <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            <span className={textClass}>Telegram</span>
          </a>

          {/* はてなブックマーク */}
          <a
            href={`https://b.hatena.ne.jp/add?mode=confirm&url=${encodedUrl}&title=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonBaseClass}
            style={{
              backgroundColor: '#00A4DE',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0093C7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#00A4DE';
            }}
            title="はてなブックマーク"
          >
            <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.47 0H3.53A3.53 3.53 0 0 0 0 3.53v16.94A3.53 3.53 0 0 0 3.53 24h16.94A3.53 3.53 0 0 0 24 20.47V3.53A3.53 3.53 0 0 0 20.47 0zm-3.294 18.824a1.412 1.412 0 1 1 0-2.824 1.412 1.412 0 0 1 0 2.824zm.588-4.706h-1.176V6.176h1.176v7.942zM6.588 18.824V5.176h3.53c1.176 0 2.117.235 2.823.706.706.47 1.059 1.176 1.059 2.117 0 .47-.118.883-.353 1.294-.235.412-.588.706-1.059.942.588.176 1.059.529 1.353.941.294.412.47.883.47 1.412 0 1-.353 1.765-1.058 2.294-.706.53-1.647.824-2.824.824H6.588zm2.118-7.647h1.294c.588 0 1-.118 1.294-.353.294-.235.412-.588.412-1.059 0-.47-.118-.824-.412-1.059-.294-.235-.706-.353-1.294-.353h-1.294v2.824zm0 5.765h1.412c.588 0 1.059-.118 1.353-.412.294-.294.47-.647.47-1.118 0-.47-.176-.824-.47-1.118-.294-.294-.765-.412-1.353-.412H8.706v3.06z"/>
            </svg>
            <span className={textClass}>はてブ</span>
          </a>
        </>
      )}

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
