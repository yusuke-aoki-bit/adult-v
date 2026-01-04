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
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="text-green-400 font-medium">{t.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          {t.title}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Field Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {t.fieldLabel}
          </label>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {t.currentValue}
            </label>
            <div className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400 text-sm">
              {currentField.currentValue || '-'}
            </div>
          </div>
        )}

        {/* Suggested Value */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {t.suggestedValue} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={suggestedValue}
            onChange={(e) => setSuggestedValue(e.target.value)}
            placeholder={t.suggestedValuePlaceholder}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
            required
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {t.reason}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reasonPlaceholder}
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {t.cancel}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !userId}
          className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
