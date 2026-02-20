'use client';

import { useState } from 'react';
import { Clock, ThumbsUp, ThumbsDown, Trash2, Star, Plus } from 'lucide-react';
import { useSceneInfo, formatTimestamp, type SceneMarker } from '../../hooks/useSceneInfo';

interface SceneTimelineProps {
  productId: number;
  duration?: number;
  theme?: 'light' | 'dark';
  locale?: string;
  onSeek?: (timestamp: number) => void;
  canEdit?: boolean;
}

const translations = {
  ja: {
    title: 'シーン情報',
    addScene: 'シーンを追加',
    noScenes: 'まだシーン情報がありません',
    beFirst: '最初のシーンを追加しましょう',
    votes: '票',
    bestScene: 'ベストシーン',
    addSceneTitle: 'シーンを追加',
    timestamp: 'タイムスタンプ',
    timestampPlaceholder: '例: 12:30',
    label: 'ラベル',
    labelPlaceholder: '例: ハイライト、名シーン',
    description: '説明（任意）',
    descriptionPlaceholder: 'このシーンの見どころを説明...',
    rating: '評価',
    cancel: 'キャンセル',
    add: '追加',
    invalidTimestamp: '正しい形式で入力してください (例: 12:30)',
  },
  en: {
    title: 'Scene Info',
    addScene: 'Add Scene',
    noScenes: 'No scene info yet',
    beFirst: 'Be the first to add a scene',
    votes: 'votes',
    bestScene: 'Best Scene',
    addSceneTitle: 'Add Scene',
    timestamp: 'Timestamp',
    timestampPlaceholder: 'e.g., 12:30',
    label: 'Label',
    labelPlaceholder: 'e.g., Highlight, Best moment',
    description: 'Description (optional)',
    descriptionPlaceholder: 'Describe what makes this scene special...',
    rating: 'Rating',
    cancel: 'Cancel',
    add: 'Add',
    invalidTimestamp: 'Please enter a valid format (e.g., 12:30)',
  },
  zh: {
    title: '场景信息',
    addScene: '添加场景',
    noScenes: '暂无场景信息',
    beFirst: '成为第一个添加场景的人',
    votes: '票',
    bestScene: '最佳场景',
    addSceneTitle: '添加场景',
    timestamp: '时间戳',
    timestampPlaceholder: '例如: 12:30',
    label: '标签',
    labelPlaceholder: '例如: 高光时刻',
    description: '描述（可选）',
    descriptionPlaceholder: '描述这个场景的亮点...',
    rating: '评分',
    cancel: '取消',
    add: '添加',
    invalidTimestamp: '请输入正确的格式 (例如: 12:30)',
  },
  ko: {
    title: '씬 정보',
    addScene: '씬 추가',
    noScenes: '아직 씬 정보가 없습니다',
    beFirst: '첫 번째로 씬을 추가해 보세요',
    votes: '표',
    bestScene: '베스트 씬',
    addSceneTitle: '씬 추가',
    timestamp: '타임스탬프',
    timestampPlaceholder: '예: 12:30',
    label: '라벨',
    labelPlaceholder: '예: 하이라이트, 명장면',
    description: '설명 (선택)',
    descriptionPlaceholder: '이 씬의 특징을 설명...',
    rating: '평점',
    cancel: '취소',
    add: '추가',
    invalidTimestamp: '올바른 형식으로 입력해주세요 (예: 12:30)',
  },
} as const;

export function SceneTimeline({
  productId,
  duration,
  theme = 'dark',
  locale = 'ja',
  onSeek,
  canEdit = true,
}: SceneTimelineProps) {
  const { sceneInfo, isLoaded, addScene, voteScene, removeScene, getVoteStatus } = useSceneInfo(productId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    timestamp: '',
    label: '',
    description: '',
    rating: 4,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  const themeClasses = {
    container: theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    card: theme === 'dark' ? 'bg-gray-700 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100',
    input: theme === 'dark'
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    button: theme === 'dark'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-pink-500 hover:bg-pink-600 text-white',
    buttonSecondary: theme === 'dark'
      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
      : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    voteUp: theme === 'dark' ? 'text-green-400' : 'text-green-600',
    voteDown: theme === 'dark' ? 'text-red-400' : 'text-red-600',
    voteNeutral: theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600',
  };

  const handleAddScene = () => {
    setFormError(null);

    // Parse timestamp
    const parts = formData.timestamp.split(':').map(Number);
    let timestampSeconds = 0;

    if (parts.length === 2 && !parts.some(isNaN)) {
      timestampSeconds = parts[0]! * 60 + parts[1]!;
    } else if (parts.length === 3 && !parts.some(isNaN)) {
      timestampSeconds = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    } else {
      setFormError(t.invalidTimestamp);
      return;
    }

    if (!formData.label.trim()) {
      setFormError('Label is required');
      return;
    }

    const trimmedDescription = formData.description.trim();
    addScene({
      timestamp: timestampSeconds,
      label: formData.label.trim(),
      rating: formData.rating,
      ...(trimmedDescription && { description: trimmedDescription }),
    });

    setFormData({ timestamp: '', label: '', description: '', rating: 4 });
    setShowAddForm(false);
  };

  const handleVote = (sceneId: string, upvote: boolean) => {
    voteScene(sceneId, upvote);
  };

  if (!isLoaded) {
    return (
      <div className={`rounded-lg border p-4 ${themeClasses.container}`}>
        <div className="animate-pulse">
          <div className={`h-6 w-32 rounded mb-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-16 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const scenes = sceneInfo?.scenes || [];
  const bestScene = sceneInfo?.bestScene;

  return (
    <div className={`rounded-lg border p-4 ${themeClasses.container}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold flex items-center gap-2 ${themeClasses.text}`}>
          <Clock className="w-5 h-5" />
          {t.title}
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(true)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${themeClasses.button}`}
          >
            <Plus className="w-4 h-4" />
            {t.addScene}
          </button>
        )}
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-md rounded-lg border p-5 ${themeClasses.container}`}>
            <h4 className={`text-lg font-semibold mb-4 ${themeClasses.text}`}>{t.addSceneTitle}</h4>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${themeClasses.text}`}>
                  {t.timestamp}
                </label>
                <input
                  type="text"
                  value={formData.timestamp}
                  onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                  placeholder={t.timestampPlaceholder}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${themeClasses.input}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${themeClasses.text}`}>
                  {t.label}
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder={t.labelPlaceholder}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${themeClasses.input}`}
                  maxLength={100}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${themeClasses.text}`}>
                  {t.description}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.descriptionPlaceholder}
                  className={`w-full px-3 py-2 rounded-lg border outline-none resize-none ${themeClasses.input}`}
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${themeClasses.text}`}>
                  {t.rating}
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="p-1"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= formData.rating
                            ? 'text-yellow-400 fill-current'
                            : themeClasses.textMuted
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${themeClasses.buttonSecondary}`}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleAddScene}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${themeClasses.button}`}
                >
                  {t.add}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {scenes.length === 0 ? (
        <div className="text-center py-8">
          <Clock className={`w-12 h-12 mx-auto mb-3 ${themeClasses.textMuted}`} />
          <p className={themeClasses.textMuted}>{t.noScenes}</p>
          <p className={`text-sm ${themeClasses.textMuted}`}>{t.beFirst}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Best Scene Badge */}
          {bestScene && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm mb-3 ${
              theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
            }`}>
              <Star className="w-4 h-4 fill-current" />
              {t.bestScene}: {formatTimestamp(bestScene.timestamp)} - {bestScene.label}
            </div>
          )}

          {/* Scene List */}
          {scenes.map((scene) => (
            <SceneItem
              key={scene.id}
              scene={scene}
              theme={theme}
              voteStatus={getVoteStatus(scene.id)}
              {...(onSeek && { onSeek })}
              onVote={handleVote}
              {...(canEdit && { onRemove: () => removeScene(scene.id) })}
              t={{ votes: t.votes }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SceneItemProps {
  scene: SceneMarker;
  theme: 'light' | 'dark';
  voteStatus: 'up' | 'down' | null;
  onSeek?: ((timestamp: number) => void) | undefined;
  onVote: (sceneId: string, upvote: boolean) => void;
  onRemove?: (() => void) | undefined;
  t: { votes: string };
}

function SceneItem({ scene, theme, voteStatus, onSeek, onVote, onRemove, t }: SceneItemProps) {
  const themeClasses = {
    card: theme === 'dark' ? 'bg-gray-700 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    timestamp: theme === 'dark' ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700',
    voteUp: voteStatus === 'up'
      ? (theme === 'dark' ? 'text-green-400' : 'text-green-600')
      : (theme === 'dark' ? 'text-gray-400 hover:text-green-400' : 'text-gray-500 hover:text-green-600'),
    voteDown: voteStatus === 'down'
      ? (theme === 'dark' ? 'text-red-400' : 'text-red-600')
      : (theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'),
  };

  return (
    <div className={`rounded-lg p-3 transition-colors ${themeClasses.card}`}>
      <div className="flex items-start gap-3">
        {/* Timestamp Badge */}
        <button
          onClick={() => onSeek?.(scene.timestamp)}
          className={`px-2 py-1 rounded text-sm font-mono font-medium shrink-0 ${themeClasses.timestamp} ${
            onSeek ? 'cursor-pointer hover:opacity-80' : ''
          }`}
        >
          {formatTimestamp(scene.timestamp)}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${themeClasses.text}`}>{scene.label}</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3 h-3 ${
                    star <= scene.rating ? 'text-yellow-400 fill-current' : themeClasses.textMuted
                  }`}
                />
              ))}
            </div>
          </div>
          {scene.description && (
            <p className={`text-sm mt-1 ${themeClasses.textMuted}`}>{scene.description}</p>
          )}
        </div>

        {/* Vote Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onVote(scene.id, true)}
            className={`p-1 transition-colors ${themeClasses.voteUp}`}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <span className={`text-sm min-w-[2rem] text-center ${themeClasses.textMuted}`}>
            {scene.votes}
          </span>
          <button
            onClick={() => onVote(scene.id, false)}
            className={`p-1 transition-colors ${themeClasses.voteDown}`}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>

          {onRemove && (
            <button
              onClick={onRemove}
              className={`p-1 ml-2 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
