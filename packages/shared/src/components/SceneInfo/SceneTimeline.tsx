'use client';

import { useState } from 'react';
import { Clock, ThumbsUp, ThumbsDown, Trash2, Star, Plus } from 'lucide-react';
import { useSceneInfo, formatTimestamp, type SceneMarker } from '../../hooks/useSceneInfo';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, sceneTimelineTranslations } from '../../lib/translations';

interface SceneTimelineProps {
  productId: number;
  duration?: number;
  theme?: 'light' | 'dark';
  locale?: string;
  onSeek?: (timestamp: number) => void;
  canEdit?: boolean;
}

export function SceneTimeline({
  productId,
  duration,
  theme: themeProp,
  locale = 'ja',
  onSeek,
  canEdit = true,
}: SceneTimelineProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const { sceneInfo, isLoaded, addScene, voteScene, removeScene, getVoteStatus } = useSceneInfo(productId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    timestamp: '',
    label: '',
    description: '',
    rating: 4,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const t = getTranslation(sceneTimelineTranslations, locale);

  const themeClasses = {
    container: theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    card: theme === 'dark' ? 'bg-gray-700 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100',
    input:
      theme === 'dark'
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    button:
      theme === 'dark' ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white' : 'bg-pink-500 hover:bg-pink-600 text-white',
    buttonSecondary:
      theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
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
          <div className={`mb-4 h-6 w-32 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
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
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`flex items-center gap-2 text-lg font-semibold ${themeClasses.text}`}>
          <Clock className="h-5 w-5" />
          {t.title}
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(true)}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${themeClasses.button}`}
          >
            <Plus className="h-4 w-4" />
            {t.addScene}
          </button>
        )}
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-md rounded-lg border p-5 ${themeClasses.container}`}>
            <h4 className={`mb-4 text-lg font-semibold ${themeClasses.text}`}>{t.addSceneTitle}</h4>

            <div className="space-y-4">
              <div>
                <label className={`mb-1 block text-sm font-medium ${themeClasses.text}`}>{t.timestamp}</label>
                <input
                  type="text"
                  value={formData.timestamp}
                  onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                  placeholder={t.timestampPlaceholder}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${themeClasses.input}`}
                />
              </div>

              <div>
                <label className={`mb-1 block text-sm font-medium ${themeClasses.text}`}>{t.label}</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder={t.labelPlaceholder}
                  className={`w-full rounded-lg border px-3 py-2 outline-none ${themeClasses.input}`}
                  maxLength={100}
                />
              </div>

              <div>
                <label className={`mb-1 block text-sm font-medium ${themeClasses.text}`}>{t.description}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.descriptionPlaceholder}
                  className={`w-full resize-none rounded-lg border px-3 py-2 outline-none ${themeClasses.input}`}
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div>
                <label className={`mb-1 block text-sm font-medium ${themeClasses.text}`}>{t.rating}</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setFormData({ ...formData, rating: star })} className="p-1">
                      <Star
                        className={`h-6 w-6 ${
                          star <= formData.rating ? 'fill-current text-yellow-400' : themeClasses.textMuted
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {formError && <p className="text-sm text-red-400">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className={`flex-1 rounded-lg px-4 py-2 font-medium ${themeClasses.buttonSecondary}`}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleAddScene}
                  className={`flex-1 rounded-lg px-4 py-2 font-medium ${themeClasses.button}`}
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
        <div className="py-8 text-center">
          <Clock className={`mx-auto mb-3 h-12 w-12 ${themeClasses.textMuted}`} />
          <p className={themeClasses.textMuted}>{t.noScenes}</p>
          <p className={`text-sm ${themeClasses.textMuted}`}>{t.beFirst}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Best Scene Badge */}
          {bestScene && (
            <div
              className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              <Star className="h-4 w-4 fill-current" />
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
    voteUp:
      voteStatus === 'up'
        ? theme === 'dark'
          ? 'text-green-400'
          : 'text-green-600'
        : theme === 'dark'
          ? 'text-gray-400 hover:text-green-400'
          : 'text-gray-500 hover:text-green-600',
    voteDown:
      voteStatus === 'down'
        ? theme === 'dark'
          ? 'text-red-400'
          : 'text-red-600'
        : theme === 'dark'
          ? 'text-gray-400 hover:text-red-400'
          : 'text-gray-500 hover:text-red-600',
  };

  return (
    <div className={`rounded-lg p-3 transition-colors ${themeClasses.card}`}>
      <div className="flex items-start gap-3">
        {/* Timestamp Badge */}
        <button
          onClick={() => onSeek?.(scene.timestamp)}
          className={`shrink-0 rounded px-2 py-1 font-mono text-sm font-medium ${themeClasses.timestamp} ${
            onSeek ? 'cursor-pointer hover:opacity-80' : ''
          }`}
        >
          {formatTimestamp(scene.timestamp)}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${themeClasses.text}`}>{scene.label}</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3 w-3 ${
                    star <= scene.rating ? 'fill-current text-yellow-400' : themeClasses.textMuted
                  }`}
                />
              ))}
            </div>
          </div>
          {scene.description && <p className={`mt-1 text-sm ${themeClasses.textMuted}`}>{scene.description}</p>}
        </div>

        {/* Vote Buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onVote(scene.id, true)} className={`p-1 transition-colors ${themeClasses.voteUp}`}>
            <ThumbsUp className="h-4 w-4" />
          </button>
          <span className={`min-w-[2rem] text-center text-sm ${themeClasses.textMuted}`}>{scene.votes}</span>
          <button onClick={() => onVote(scene.id, false)} className={`p-1 transition-colors ${themeClasses.voteDown}`}>
            <ThumbsDown className="h-4 w-4" />
          </button>

          {onRemove && (
            <button
              onClick={onRemove}
              className={`ml-2 p-1 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
