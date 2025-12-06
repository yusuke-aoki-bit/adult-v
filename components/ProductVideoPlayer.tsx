'use client';

import { useState } from 'react';
import { Play, Film, AlertCircle } from 'lucide-react';

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

export default function ProductVideoPlayer({ sampleVideos }: ProductVideoPlayerProps) {
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(
    sampleVideos && sampleVideos.length > 0 ? sampleVideos[0] : null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

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
      preview: 'プレビュー',
      trailer: '予告編',
      streaming: 'ストリーミング',
      download: 'ダウンロード',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      {/* メイン動画プレイヤー */}
      <div className="relative aspect-video w-full bg-gray-900 rounded-lg overflow-hidden">
        {!isPlaying && (
          <button
            onClick={handlePlayClick}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 hover:bg-black/40 transition-colors group"
          >
            <Play className="w-20 h-20 text-white group-hover:scale-110 transition-transform" fill="white" />
            <p className="text-white text-lg mt-4">サンプル動画を再生</p>
            {selectedVideo?.quality && (
              <p className="text-gray-300 text-sm mt-1">{selectedVideo.quality}</p>
            )}
          </button>
        )}
        {isPlaying && selectedVideo && !hasError && (
          <video
            src={selectedVideo.url}
            controls
            autoPlay
            className="w-full h-full"
            controlsList="nodownload"
            onError={handleVideoError}
          >
            お使いのブラウザは動画タグをサポートしていません。
          </video>
        )}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-white text-lg mb-2">動画を読み込めませんでした</p>
            <p className="text-gray-400 text-sm mb-4 text-center px-4">
              配信元サイトのセキュリティ制限により、<br />
              直接再生できない場合があります
            </p>
            <div className="flex gap-3">
              {selectedVideo && (
                <a
                  href={selectedVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition-colors"
                >
                  配信元で再生
                </a>
              )}
              <button
                onClick={() => {
                  setHasError(false);
                  setIsPlaying(false);
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                閉じる
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
                  ? 'border-rose-600 bg-rose-950/30 ring-2 ring-rose-600/50'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'
              }`}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <Film className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-300">
                  {getVideoTypeLabel(video.type)} {idx + 1}
                </p>
                {video.quality && (
                  <p className="text-xs text-gray-400 mt-1">{video.quality}</p>
                )}
                {video.duration && (
                  <p className="text-xs text-gray-500 mt-1">{formatDuration(video.duration)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 動画本数表示 */}
      <p className="text-sm text-gray-400 text-center">
        サンプル動画: {sampleVideos.length}本
      </p>
    </div>
  );
}
