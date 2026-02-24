'use client';

import { useState, useEffect } from 'react';
import { Play, Film, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface VideoInfo {
  url: string;
  type: string; // 'streaming', 'download', 'preview', 'trailer'
  quality?: string; // '720p', '1080p', '4k'
  duration?: number; // seconds
}

interface ProductVideoPlayerProps {
  sampleVideos?: VideoInfo[];
  productTitle: string;
}

// 動画URLからソースを判定
function getVideoSource(url: string): 'dmm' | 'mgs' | 'other' {
  if (url.includes('dmm.co.jp') || url.includes('dmm.com')) return 'dmm';
  if (url.includes('mgstage.com')) return 'mgs';
  return 'other';
}

export default function ProductVideoPlayer({ sampleVideos }: ProductVideoPlayerProps) {
  const t = useTranslations('productVideoPlayer');
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(
    sampleVideos && sampleVideos.length > 0 ? sampleVideos[0]! : null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [_videoLoadAttempted, setVideoLoadAttempted] = useState(false);

  // 選択動画が変わったらリセット
  useEffect(() => {
    setHasError(false);
    setVideoLoadAttempted(false);
  }, [selectedVideo]);

  if (!sampleVideos || sampleVideos.length === 0) {
    return null; // 動画がない場合は何も表示しない
  }

  const handlePlayClick = () => {
    setHasError(false);
    setVideoLoadAttempted(true);
    setIsPlaying(true);
  };

  const handleVideoError = () => {
    setHasError(true);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVideoTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      preview: t('preview'),
      trailer: t('trailer'),
      streaming: t('streaming'),
      download: t('download'),
      sample: t('preview'),
    };
    return labels[type] || type;
  };

  // 動画ソースに応じたラベル
  const getSourceLabel = (url: string) => {
    const source = getVideoSource(url);
    switch (source) {
      case 'dmm':
        return 'FANZA';
      case 'mgs':
        return 'MGS';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* メイン動画プレイヤー */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-900">
        {!isPlaying && (
          <button
            onClick={handlePlayClick}
            className="group absolute inset-0 flex flex-col items-center justify-center bg-black/50 transition-colors hover:bg-black/40"
          >
            <Play className="h-20 w-20 text-white transition-transform group-hover:scale-110" fill="white" />
            <p className="mt-4 text-lg text-white">{t('playSampleVideo')}</p>
            {selectedVideo?.quality && <p className="mt-1 text-sm text-gray-300">{selectedVideo.quality}</p>}
          </button>
        )}
        {isPlaying && selectedVideo && !hasError && (
          <video
            key={selectedVideo.url}
            src={selectedVideo.url}
            controls
            autoPlay
            playsInline
            className="h-full w-full"
            controlsList="nodownload"
            onError={handleVideoError}
            onLoadedData={() => setHasError(false)}
          >
            {t('browserNotSupported')}
          </video>
        )}
        {hasError && selectedVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 p-4">
            <ExternalLink className="mb-4 h-12 w-12 text-gray-400" />
            <p className="mb-2 text-center text-lg text-white">{t('externalVideoTitle')}</p>
            <p className="mb-6 max-w-md text-center text-sm text-gray-400">{t('externalVideoDescription')}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={selectedVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-6 py-3 text-white transition-colors hover:bg-fuchsia-500"
              >
                <ExternalLink className="h-5 w-5" />
                {t('playInNewTab')}
                {getSourceLabel(selectedVideo.url) && (
                  <span className="text-sm text-fuchsia-200">({getSourceLabel(selectedVideo.url)})</span>
                )}
              </a>
              <button
                onClick={() => {
                  setHasError(false);
                  setIsPlaying(false);
                  setVideoLoadAttempted(false);
                }}
                className="rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 動画一覧（複数動画がある場合のみ） */}
      {sampleVideos.length > 1 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {sampleVideos.map((video, idx) => (
            <button
              key={video.url}
              onClick={() => {
                setSelectedVideo(video);
                setIsPlaying(false);
                setHasError(false);
              }}
              className={`relative aspect-video overflow-hidden rounded-lg border-2 p-4 transition-all ${
                selectedVideo === video
                  ? 'border-fuchsia-600 bg-fuchsia-950/30 ring-2 ring-fuchsia-600/50'
                  : 'hover:bg-gray-750 border-gray-700 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <div className="flex h-full flex-col items-center justify-center">
                <Film className="mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-300">
                  {getVideoTypeLabel(video.type)} {idx + 1}
                </p>
                {video.quality && <p className="mt-1 text-xs text-gray-400">{video.quality}</p>}
                {video.duration && <p className="mt-1 text-xs text-gray-500">{formatDuration(video.duration)}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 動画本数表示 */}
      <p className="text-center text-sm text-gray-400">{t('sampleVideoCount', { count: sampleVideos.length })}</p>
    </div>
  );
}
