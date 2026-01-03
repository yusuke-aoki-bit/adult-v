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
    sampleVideos && sampleVideos.length > 0 ? sampleVideos[0] : null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 選択動画が変わったらリセット
  useEffect(() => {
    setHasError(false);
  }, [selectedVideo]);

  if (!sampleVideos || sampleVideos.length === 0) {
    return null; // 動画がない場合は何も表示しない
  }

  const handlePlayClick = () => {
    setHasError(false);
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
      case 'dmm': return 'FANZA';
      case 'mgs': return 'MGS';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* メイン動画プレイヤー */}
      <div className="relative aspect-video w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
        {!isPlaying && (
          <button
            onClick={handlePlayClick}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 hover:bg-black/40 transition-colors group"
          >
            <Play className="w-20 h-20 text-white group-hover:scale-110 transition-transform" fill="white" />
            <p className="text-white text-lg mt-4">{t('playSampleVideo')}</p>
            {selectedVideo?.quality && (
              <p className="text-gray-300 text-sm mt-1">{selectedVideo.quality}</p>
            )}
          </button>
        )}
        {isPlaying && selectedVideo && !hasError && (
          <video
            key={selectedVideo.url}
            src={selectedVideo.url}
            controls
            autoPlay
            playsInline
            className="w-full h-full"
            controlsList="nodownload"
            onError={handleVideoError}
            onLoadedData={() => setHasError(false)}
          >
            {t('browserNotSupported')}
          </video>
        )}
        {hasError && selectedVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 p-4">
            <ExternalLink className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-800 text-lg mb-2 text-center">{t('externalVideoTitle')}</p>
            <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
              {t('externalVideoDescription')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={selectedVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-5 h-5" />
                {t('playInNewTab')}
                {getSourceLabel(selectedVideo.url) && (
                  <span className="text-rose-200 text-sm">({getSourceLabel(selectedVideo.url)})</span>
                )}
              </a>
              <button
                onClick={() => {
                  setHasError(false);
                  setIsPlaying(false);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 動画一覧（複数動画がある場合のみ） */}
      {sampleVideos.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sampleVideos.map((video, idx) => (
            <button
              key={video.url}
              onClick={() => {
                setSelectedVideo(video);
                setIsPlaying(false);
                setHasError(false);
              }}
              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all p-4 ${
                selectedVideo === video
                  ? 'border-rose-700 bg-rose-50 ring-2 ring-rose-700/50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <Film className="w-8 h-8 text-gray-500 mb-2" />
                <p className="text-sm text-gray-700">
                  {getVideoTypeLabel(video.type)} {idx + 1}
                </p>
                {video.quality && (
                  <p className="text-xs text-gray-500 mt-1">{video.quality}</p>
                )}
                {video.duration && (
                  <p className="text-xs text-gray-400 mt-1">{formatDuration(video.duration)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 動画本数表示 */}
      <p className="text-sm text-gray-500 text-center">
        {t('sampleVideoCount', { count: sampleVideos.length })}
      </p>
    </div>
  );
}
