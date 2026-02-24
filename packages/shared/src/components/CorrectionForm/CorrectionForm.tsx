'use client';

import { useState } from 'react';
import { AlertCircle, Send, X, CheckCircle } from 'lucide-react';

export interface CorrectionFormTranslations {
  title: string;
  fieldLabel: string;
  currentValue: string;
  suggestedValue: string;
  suggestedValuePlaceholder: string;
  reason: string;
  reasonPlaceholder: string;
  submit: string;
  submitting: string;
  cancel: string;
  success: string;
  error: string;
  loginRequired: string;
  fieldRequired: string;
  valueRequired: string;
}

export interface CorrectionFormProps {
  targetType: 'product' | 'performer';
  targetId: number;
  userId: string | null;
  fields: Array<{
    name: string;
    label: string;
    currentValue: string | null;
  }>;
  onSubmit: (data: {
    fieldName: string;
    currentValue: string | null;
    suggestedValue: string;
    reason: string | null;
  }) => Promise<void>;
  onClose?: () => void;
  translations: CorrectionFormTranslations;
}

export function CorrectionForm({
  targetType,
  targetId,
  userId,
  fields,
  onSubmit,
  onClose,
  translations: t,
}: CorrectionFormProps) {
  const [selectedField, setSelectedField] = useState(fields[0]?.name ?? '');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const currentField = fields.find((f) => f.name === selectedField);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError(t.loginRequired);
      return;
    }

    if (!selectedField) {
      setError(t.fieldRequired);
      return;
    }

    if (!suggestedValue.trim()) {
      setError(t.valueRequired);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        fieldName: selectedField,
        currentValue: currentField?.currentValue ?? null,
        suggestedValue: suggestedValue.trim(),
        reason: reason.trim() || null,
      });
      setSuccess(true);
      setSuggestedValue('');
      setReason('');
      setTimeout(() => {
        setSuccess(false);
        onClose?.();
      }, 2000);
    } catch (err) {
      setError(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg bg-gray-800 p-6 text-center">
        <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
        <p className="font-medium text-green-400">{t.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          {t.title}
        </h3>
        {onClose && (
          <button type="button" onClick={onClose} className="text-gray-400 transition-colors hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-900/50 p-3 text-sm text-red-300">{error}</div>
      )}

      <div className="space-y-4">
        {/* Field Selection */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t.fieldLabel}</label>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
          >
            {fields.map((field) => (
              <option key={field.name} value={field.name}>
                {field.label}
              </option>
            ))}
          </select>
        </div>

        {/* Current Value (Read-only) */}
        {currentField && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t.currentValue}</label>
            <div className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400">
              {currentField.currentValue || '-'}
            </div>
          </div>
        )}

        {/* Suggested Value */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            {t.suggestedValue} <span className="text-fuchsia-500">*</span>
          </label>
          <input
            type="text"
            value={suggestedValue}
            onChange={(e) => setSuggestedValue(e.target.value)}
            placeholder={t.suggestedValuePlaceholder}
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
            required
          />
        </div>

        {/* Reason */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t.reason}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reasonPlaceholder}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
          >
            {t.cancel}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !userId}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2 font-medium text-white transition-colors hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin">⏳</span>
              {t.submitting}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {t.submit}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default CorrectionForm;
