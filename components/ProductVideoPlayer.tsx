'use client';

import { useState } from 'react';
import { Play, Film } from 'lucide-react';

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

export default function ProductVideoPlayer({ sampleVideos, productTitle }: ProductVideoPlayerProps) {
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(
    sampleVideos && sampleVideos.length > 0 ? sampleVideos[0] : null
  );
  const [isPlaying, setIsPlaying] = useState(false);

  if (!sampleVideos || sampleVideos.length === 0) {
    return null; // 動画がない場合は何も表示しない
  }

  const handlePlayClick = () => {
    setIsPlaying(true);
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
        {isPlaying && selectedVideo && (
          <video
            src={selectedVideo.url}
            controls
            autoPlay
            className="w-full h-full"
            controlsList="nodownload"
          >
            お使いのブラウザは動画タグをサポートしていません。
          </video>
        )}
      </div>

      {/* 動画一覧（複数動画がある場合のみ） */}
      {sampleVideos.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sampleVideos.map((video, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedVideo(video);
                setIsPlaying(false);
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
                  {getVideoTypeLabel(video.type)} {index + 1}
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
