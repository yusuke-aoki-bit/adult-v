'use client';

import { useState } from 'react';
import { Clock, CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export interface Correction {
  id: number;
  targetType: 'product' | 'performer';
  targetId: number;
  userId: string;
  fieldName: string;
  currentValue: string | null;
  suggestedValue: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface CorrectionListTranslations {
  title: string;
  empty: string;
  pending: string;
  approved: string;
  rejected: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  submittedAt: string;
  reviewedAt: string;
  delete: string;
  deleteConfirm: string;
  showMore: string;
  showLess: string;
}

export interface CorrectionListProps {
  corrections: Correction[];
  currentUserId: string | null;
  fieldLabels: Record<string, string>;
  onDelete?: (correctionId: number) => Promise<void>;
  translations: CorrectionListTranslations;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({
  status,
  translations,
}: {
  status: Correction['status'];
  translations: CorrectionListTranslations;
}) {
  const config = {
    pending: {
      icon: Clock,
      color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
      label: translations.pending,
    },
    approved: {
      icon: CheckCircle,
      color: 'text-green-400 bg-green-900/30 border-green-700',
      label: translations.approved,
    },
    rejected: {
      icon: XCircle,
      color: 'text-red-400 bg-red-900/30 border-red-700',
      label: translations.rejected,
    },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function CorrectionList({
  corrections,
  currentUserId,
  fieldLabels,
  onDelete,
  translations: t,
}: CorrectionListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (correction: Correction) => {
    if (!onDelete) return;
    if (!confirm(t.deleteConfirm)) return;

    setDeletingId(correction['id']);
    try {
      await onDelete(correction['id']);
    } finally {
      setDeletingId(null);
    }
  };

  if (corrections.length === 0) {
    return <div className="py-8 text-center text-gray-500">{t.empty}</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="mb-3 text-sm font-medium text-gray-400">{t.title}</h4>

      {corrections.map((correction) => {
        const isExpanded = expandedId === correction['id'];
        const canDelete = currentUserId === correction['userId'] && correction['status'] === 'pending';

        return (
          <div key={correction['id']} className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800/50">
            {/* Header */}
            <div
              className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-gray-800/80"
              onClick={() => setExpandedId(isExpanded ? null : correction['id'])}
            >
              <div className="flex items-center gap-3">
                <StatusBadge status={correction['status']} translations={t} />
                <span className="text-sm font-medium text-white">
                  {fieldLabels[correction['fieldName']] || correction['fieldName']}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{formatDate(correction['createdAt'])}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="space-y-3 border-t border-gray-700 px-3 pt-3 pb-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs text-gray-500">{t.currentValue}</p>
                    <p className="text-gray-300">{correction['currentValue'] || '-'}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-gray-500">{t.suggestedValue}</p>
                    <p className="font-medium text-white">{correction['suggestedValue']}</p>
                  </div>
                </div>

                {correction['reason'] && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">{t.reason}</p>
                    <p className="text-sm text-gray-300">{correction['reason']}</p>
                  </div>
                )}

                {correction['status'] !== 'pending' && correction['reviewedAt'] && (
                  <div className="text-xs text-gray-500">
                    {t.reviewedAt}: {formatDate(correction['reviewedAt'])}
                  </div>
                )}

                {canDelete && onDelete && (
                  <div className="border-t border-gray-700 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(correction);
                      }}
                      disabled={deletingId === correction['id']}
                      className="flex items-center gap-1 text-sm text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === correction['id'] ? '...' : t.delete}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default CorrectionList;
