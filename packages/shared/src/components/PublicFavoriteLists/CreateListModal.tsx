'use client';

import { useState } from 'react';
import { X, Globe, Lock, Loader2 } from 'lucide-react';

export interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; isPublic: boolean }) => Promise<void>;
  editingList?: {
    id: number;
    title: string;
    description: string | null;
    isPublic: boolean;
  } | null;
  translations: {
    createTitle: string;
    editTitle: string;
    titleLabel: string;
    titlePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    visibilityLabel: string;
    public: string;
    publicDescription: string;
    private: string;
    privateDescription: string;
    cancel: string;
    create: string;
    save: string;
    creating: string;
    saving: string;
  };
}

export function CreateListModal({ isOpen, onClose, onSubmit, editingList, translations: t }: CreateListModalProps) {
  const [title, setTitle] = useState(editingList?.title || '');
  const [description, setDescription] = useState(editingList?.description || '');
  const [isPublic, setIsPublic] = useState(editingList?.isPublic ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), isPublic });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingList ? t.editTitle : t.createTitle}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t.titleLabel}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.titlePlaceholder}
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.descriptionLabel}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descriptionPlaceholder}
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visibilityLabel}
            </label>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isPublic
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                <input type="radio" checked={isPublic} onChange={() => setIsPublic(true)} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                    <Globe className="h-4 w-4 text-green-500" />
                    {t.public}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.publicDescription}</p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  !isPublic
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                <input type="radio" checked={!isPublic} onChange={() => setIsPublic(false)} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                    <Lock className="h-4 w-4 text-gray-400" />
                    {t.private}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.privateDescription}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || title.trim().length < 2}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingList ? t.saving : t.creating}
                </>
              ) : editingList ? (
                t.save
              ) : (
                t.create
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
