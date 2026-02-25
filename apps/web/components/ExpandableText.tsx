'use client';

import { useState, useRef, useEffect } from 'react';

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export default function ExpandableText({ text, maxLines = 3, className = '' }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setClamped(el.scrollHeight > el.clientHeight);
    }
  }, [text]);

  return (
    <div>
      <p
        ref={ref}
        className={`whitespace-pre-wrap ${className} ${!expanded ? `line-clamp-${maxLines}` : ''}`}
        style={
          !expanded
            ? { WebkitLineClamp: maxLines, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }
            : undefined
        }
      >
        {text}
      </p>
      {clamped && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="theme-text-accent mt-1 text-sm font-medium transition-opacity hover:opacity-80"
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
