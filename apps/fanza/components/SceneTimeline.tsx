'use client';

import { useState } from 'react';
import { Clock, Star, Plus, ThumbsUp, ThumbsDown, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSceneInfo, formatTimestamp, parseTimestamp, type SceneMarker } from '@adult-v/shared/hooks/useSceneInfo';

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
    voted: 'Voted',
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
    alreadyVoted: '已经投过票了',
    voted: '已投票',
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
    voted: '투표했습니다',
  },
} as const;

type TranslationKey = keyof typeof translations;

interface SceneTimelineProps {
  productId: number;
  totalDuration?: number;
  locale?: string;
}

export default function SceneTimeline({ productId, totalDuration, locale = 'ja' }: SceneTimelineProps) {
  const t = translations[locale as TranslationKey] || translations.ja;
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
      <div className="theme-content theme-border animate-pulse rounded-xl border p-4">
        <div className="mb-4 h-6 w-1/3 rounded bg-gray-200" />
        <div className="h-24 rounded bg-gray-200" />
      </div>
    );
  }

  const scenes = sceneInfo?.scenes || [];
  const displayScenes = showAll ? scenes : scenes.slice(0, 5);
  const hasMore = scenes.length > 5;

  return (
    <div className="theme-content theme-border rounded-xl border p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="theme-text flex items-center gap-2 font-semibold">
            <Clock className="h-5 w-5 text-blue-500" />
            {t.title}
          </h3>
          <p className="theme-text-muted mt-0.5 text-xs">{t.description}</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
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
          className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
          aria-label={t.addScene}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="scene-timestamp" className="theme-text-muted mb-1 block text-xs">
                {t.timestamp}
              </label>
              <input
                id="scene-timestamp"
                type="text"
                value={formData.timestamp}
                onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                placeholder="5:30"
                maxLength={10}
                aria-describedby="timestamp-hint"
                className="theme-text w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span id="timestamp-hint" className="sr-only">
                Format: MM:SS or HH:MM:SS
              </span>
            </div>
            <div>
              <label htmlFor="scene-end-timestamp" className="theme-text-muted mb-1 block text-xs">
                {t.endTime}
              </label>
              <input
                id="scene-end-timestamp"
                type="text"
                value={formData.endTimestamp}
                onChange={(e) => setFormData({ ...formData, endTimestamp: e.target.value })}
                placeholder="15:00"
                maxLength={10}
                className="theme-text w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="scene-label" className="theme-text-muted mb-1 block text-xs">
              {t.label}
            </label>
            <input
              id="scene-label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder={t.labelPlaceholder}
              maxLength={100}
              className="theme-text w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label id="rating-label" className="theme-text-muted mb-1 block text-xs">
              {t.rating}
            </label>
            <div className="flex gap-1" role="radiogroup" aria-labelledby="rating-label">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  aria-checked={formData.rating === star}
                  className={`p-1 ${star <= formData.rating ? 'text-yellow-500' : 'text-gray-300'}`}
                >
                  <Star className="h-5 w-5 fill-current" />
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-500" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              {t.submit}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setError('');
              }}
              className="flex-1 rounded bg-gray-200 py-2 text-sm text-gray-700 hover:bg-gray-300"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Scene List */}
      {scenes.length === 0 ? (
        <div className="py-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-gray-300" />
          <p className="theme-text-muted mt-2 text-sm">{t.noScenes}</p>
        </div>
      ) : (
        <>
          {/* Timeline Visualization */}
          {totalDuration && (
            <div className="mb-4">
              <div className="relative h-2 rounded-full bg-gray-200">
                {scenes.map((scene) => {
                  const position = (scene.timestamp / (totalDuration * 60)) * 100;
                  const width = scene.endTimestamp
                    ? ((scene.endTimestamp - scene.timestamp) / (totalDuration * 60)) * 100
                    : 2;
                  return (
                    <div
                      key={scene.id}
                      className={`absolute h-full rounded-full ${
                        scene.rating >= 4 ? 'bg-yellow-500' : scene.rating >= 3 ? 'bg-blue-500' : 'bg-gray-400'
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
              className="theme-text-muted hover:theme-text mt-3 flex w-full items-center justify-center gap-1 py-2 text-sm"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  {t.hideExtra}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
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
      className={`rounded-lg p-3 ${
        bestScene ? 'border border-yellow-300 bg-yellow-50' : 'border border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-blue-600">
              {formatTimestamp(scene.timestamp)}
              {scene.endTimestamp && (
                <span className="text-gray-400">
                  {' -> '}
                  {formatTimestamp(scene.endTimestamp)}
                </span>
              )}
            </span>
            {bestScene && (
              <span className="rounded bg-yellow-200 px-2 py-0.5 text-xs text-yellow-800">{t.bestScene}</span>
            )}
            {scene.votes >= 3 && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{t.popular}</span>
            )}
          </div>
          <p className="theme-text mt-1 text-sm">{scene.label}</p>
          {scene.description && <p className="theme-text-muted mt-0.5 text-xs">{scene.description}</p>}
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-3 w-3 ${star <= scene.rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
              />
            ))}
          </div>
        </div>

        {/* Voting */}
        <div className="ml-2 flex items-center gap-1" role="group" aria-label="Vote actions">
          <button
            type="button"
            onClick={() => onVote(scene.id, true)}
            aria-label={`Upvote ${scene.label}`}
            aria-pressed={voteStatus === 'up'}
            className={`p-1 transition-colors ${
              voteStatus === 'up' ? 'text-green-500' : 'text-gray-400 hover:text-green-500'
            }`}
          >
            <ThumbsUp className={`h-4 w-4 ${voteStatus === 'up' ? 'fill-current' : ''}`} />
          </button>
          <span className="theme-text-muted w-6 text-center text-xs" aria-label={`${scene.votes} votes`}>
            {scene.votes}
          </span>
          <button
            type="button"
            onClick={() => onVote(scene.id, false)}
            aria-label={`Downvote ${scene.label}`}
            aria-pressed={voteStatus === 'down'}
            className={`p-1 transition-colors ${
              voteStatus === 'down' ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
            }`}
          >
            <ThumbsDown className={`h-4 w-4 ${voteStatus === 'down' ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(scene.id)}
            aria-label={`Delete ${scene.label}`}
            className="ml-1 p-1 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
