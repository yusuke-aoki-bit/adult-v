'use client';

import { useState } from 'react';
import {
  Clock,
  Star,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  useSceneInfo,
  formatTimestamp,
  parseTimestamp,
  type SceneMarker,
} from '@adult-v/shared/hooks/useSceneInfo';

const translations = {
  ja: {
    title: 'シーン情報',
    description: 'ユーザー投稿のシーン構成',
    noScenes: 'まだシーン情報がありません',
    addScene: 'シーンを追加',
    timestamp: 'タイムスタンプ',
    endTime: '終了時間（任意）',
    label: 'ラベル',
    labelPlaceholder: '例: 導入、シーン1、ベストシーン',
    descPlaceholder: 'シーンの説明（任意）',
    rating: '評価',
    submit: '投稿',
    cancel: 'キャンセル',
    bestScene: 'ベストシーン',
    popular: '人気',
    votes: '票',
    showAll: 'すべて表示',
    hideExtra: '折りたたむ',
    timestampError: '正しい形式で入力 (例: 5:30 or 1:05:30)',
    confirmDelete: '本当に削除しますか？',
    alreadyVoted: '既に投票済みです',
    voted: '投票しました',
  },
  en: {
    title: 'Scene Info',
    description: 'User-submitted scene breakdown',
    noScenes: 'No scene info yet',
    addScene: 'Add Scene',
    timestamp: 'Timestamp',
    endTime: 'End Time (optional)',
    label: 'Label',
    labelPlaceholder: 'e.g., Intro, Scene 1, Best Scene',
    descPlaceholder: 'Description (optional)',
    rating: 'Rating',
    submit: 'Submit',
    cancel: 'Cancel',
    bestScene: 'Best Scene',
    popular: 'Popular',
    votes: 'votes',
    showAll: 'Show All',
    hideExtra: 'Collapse',
    timestampError: 'Enter valid format (e.g., 5:30 or 1:05:30)',
    confirmDelete: 'Are you sure you want to delete?',
    alreadyVoted: 'Already voted',
    voted: 'Vote recorded',
  },
  zh: {
    title: '场景信息',
    description: '用户提交的场景构成',
    noScenes: '暂无场景信息',
    addScene: '添加场景',
    timestamp: '时间戳',
    endTime: '结束时间（可选）',
    label: '标签',
    labelPlaceholder: '例如：导入、场景1、最佳场景',
    descPlaceholder: '描述（可选）',
    rating: '评分',
    submit: '提交',
    cancel: '取消',
    bestScene: '最佳场景',
    popular: '热门',
    votes: '票',
    showAll: '显示全部',
    hideExtra: '折叠',
    timestampError: '请输入正确格式（例：5:30 或 1:05:30）',
    confirmDelete: '确定要删除吗？',
    alreadyVoted: '已投票',
    voted: '投票成功',
  },
  ko: {
    title: '씬 정보',
    description: '사용자 제출 씬 구성',
    noScenes: '아직 씬 정보가 없습니다',
    addScene: '씬 추가',
    timestamp: '타임스탬프',
    endTime: '종료 시간(선택)',
    label: '라벨',
    labelPlaceholder: '예: 도입, 씬 1, 베스트 씬',
    descPlaceholder: '설명(선택)',
    rating: '평가',
    submit: '제출',
    cancel: '취소',
    bestScene: '베스트 씬',
    popular: '인기',
    votes: '표',
    showAll: '전체 보기',
    hideExtra: '접기',
    timestampError: '올바른 형식으로 입력하세요 (예: 5:30 또는 1:05:30)',
    confirmDelete: '정말 삭제하시겠습니까?',
    alreadyVoted: '이미 투표했습니다',
    voted: '투표 완료',
  },
} as const;

type TranslationKey = keyof typeof translations;

interface SceneTimelineProps {
  productId: number;
  totalDuration?: number;
  locale?: string;
}

export default function SceneTimeline({
  productId,
  totalDuration,
  locale = 'ja',
}: SceneTimelineProps) {
  const t = translations[locale as TranslationKey] || translations['ja'];
  const { sceneInfo, isLoaded, addScene, voteScene, removeScene, getVoteStatus } = useSceneInfo(productId);

  const handleRemove = (sceneId: string) => {
    if (window.confirm(t.confirmDelete)) {
      removeScene(sceneId);
    }
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [formData, setFormData] = useState({
    timestamp: '',
    endTimestamp: '',
    label: '',
    description: '',
    rating: 3,
  });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    const timestamp = parseTimestamp(formData.timestamp);
    if (timestamp === null) {
      setError(t.timestampError);
      return;
    }

    let endTimestamp: number | undefined;
    if (formData.endTimestamp) {
      endTimestamp = parseTimestamp(formData.endTimestamp) ?? undefined;
    }

    addScene({
      timestamp,
      endTimestamp,
      label: formData.label || `Scene`,
      description: formData.description || undefined,
      rating: formData.rating,
    });

    setFormData({
      timestamp: '',
      endTimestamp: '',
      label: '',
      description: '',
      rating: 3,
    });
    setShowAddForm(false);
  };

  if (!isLoaded) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-24 bg-gray-700 rounded" />
      </div>
    );
  }

  const scenes = sceneInfo?.scenes || [];
  const displayScenes = showAll ? scenes : scenes.slice(0, 5);
  const hasMore = scenes.length > 5;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            {t.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            <Plus className="w-4 h-4" />
            {t.addScene}
          </button>
        )}
      </div>

      {/* Add Scene Form */}
      {showAddForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="bg-gray-700/50 rounded-lg p-4 mb-4 space-y-3"
          aria-label={t.addScene}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="scene-timestamp" className="text-xs text-gray-400 block mb-1">{t.timestamp}</label>
              <input
                id="scene-timestamp"
                type="text"
                value={formData.timestamp}
                onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                placeholder="5:30"
                maxLength={10}
                aria-describedby="timestamp-hint"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span id="timestamp-hint" className="sr-only">Format: MM:SS or HH:MM:SS</span>
            </div>
            <div>
              <label htmlFor="scene-end-timestamp" className="text-xs text-gray-400 block mb-1">{t.endTime}</label>
              <input
                id="scene-end-timestamp"
                type="text"
                value={formData.endTimestamp}
                onChange={(e) => setFormData({ ...formData, endTimestamp: e.target.value })}
                placeholder="15:00"
                maxLength={10}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="scene-label" className="text-xs text-gray-400 block mb-1">{t.label}</label>
            <input
              id="scene-label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder={t.labelPlaceholder}
              maxLength={100}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label id="rating-label" className="text-xs text-gray-400 block mb-1">{t.rating}</label>
            <div className="flex gap-1" role="radiogroup" aria-labelledby="rating-label">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  aria-checked={formData.rating === star}
                  className={`p-1 ${
                    star <= formData.rating ? 'text-yellow-400' : 'text-gray-600'
                  }`}
                >
                  <Star className="w-5 h-5 fill-current" />
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-xs" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-medium"
            >
              {t.submit}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setError('');
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded text-sm"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Scene List */}
      {scenes.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-gray-500 mt-2 text-sm">{t.noScenes}</p>
        </div>
      ) : (
        <>
          {/* Timeline Visualization */}
          {totalDuration && (
            <div className="mb-4">
              <div className="h-2 bg-gray-700 rounded-full relative">
                {scenes.map((scene) => {
                  const position = (scene.timestamp / (totalDuration * 60)) * 100;
                  const width = scene.endTimestamp
                    ? ((scene.endTimestamp - scene.timestamp) / (totalDuration * 60)) * 100
                    : 2;
                  return (
                    <div
                      key={scene.id}
                      className={`absolute h-full rounded-full ${
                        scene.rating >= 4
                          ? 'bg-yellow-500'
                          : scene.rating >= 3
                          ? 'bg-blue-500'
                          : 'bg-gray-500'
                      }`}
                      style={{
                        left: `${Math.min(position, 100)}%`,
                        width: `${Math.min(width, 100 - position)}%`,
                        minWidth: '4px',
                      }}
                      title={`${scene.label} (${formatTimestamp(scene.timestamp)})`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Scene Cards */}
          <div className="space-y-2">
            {displayScenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={index}
                bestScene={sceneInfo?.bestScene?.id === scene.id}
                onVote={voteScene}
                onRemove={handleRemove}
                getVoteStatus={getVoteStatus}
                t={t}
              />
            ))}
          </div>

          {/* Show More */}
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white flex items-center justify-center gap-1"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t.hideExtra}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {t.showAll} ({scenes.length})
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Scene Card Component
function SceneCard({
  scene,
  index: _index,
  bestScene,
  onVote,
  onRemove,
  getVoteStatus,
  t,
}: {
  scene: SceneMarker;
  index: number;
  bestScene: boolean;
  onVote: (id: string, upvote: boolean) => 'voted' | 'toggled' | 'already_voted' | 'failed';
  onRemove: (id: string) => void;
  getVoteStatus: (id: string) => 'up' | 'down' | null;
  t: (typeof translations)[TranslationKey];
}) {
  const voteStatus = getVoteStatus(scene.id);

  return (
    <div
      className={`p-3 rounded-lg ${
        bestScene ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-gray-700/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-blue-400 font-mono text-sm">
              {formatTimestamp(scene.timestamp)}
              {scene.endTimestamp && (
                <span className="text-gray-500">
                  {' → '}
                  {formatTimestamp(scene.endTimestamp)}
                </span>
              )}
            </span>
            {bestScene && (
              <span className="text-xs px-2 py-0.5 bg-yellow-800 text-yellow-300 rounded">
                {t.bestScene}
              </span>
            )}
            {scene.votes >= 3 && (
              <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded">
                {t.popular}
              </span>
            )}
          </div>
          <p className="text-white text-sm mt-1">{scene.label}</p>
          {scene.description && (
            <p className="text-gray-400 text-xs mt-0.5">{scene.description}</p>
          )}
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3 h-3 ${
                  star <= scene.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Voting */}
        <div className="flex items-center gap-1 ml-2" role="group" aria-label="Vote actions">
          <button
            type="button"
            onClick={() => onVote(scene.id, true)}
            aria-label={`Upvote ${scene.label}`}
            aria-pressed={voteStatus === 'up'}
            className={`p-1 transition-colors ${
              voteStatus === 'up'
                ? 'text-green-400'
                : 'text-gray-500 hover:text-green-400'
            }`}
          >
            <ThumbsUp className={`w-4 h-4 ${voteStatus === 'up' ? 'fill-current' : ''}`} />
          </button>
          <span className="text-xs text-gray-400 w-6 text-center" aria-label={`${scene.votes} votes`}>{scene.votes}</span>
          <button
            type="button"
            onClick={() => onVote(scene.id, false)}
            aria-label={`Downvote ${scene.label}`}
            aria-pressed={voteStatus === 'down'}
            className={`p-1 transition-colors ${
              voteStatus === 'down'
                ? 'text-red-400'
                : 'text-gray-500 hover:text-red-400'
            }`}
          >
            <ThumbsDown className={`w-4 h-4 ${voteStatus === 'down' ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(scene.id)}
            aria-label={`Delete ${scene.label}`}
            className="p-1 text-gray-500 hover:text-red-400 ml-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
