'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { UserReviewForm } from './UserReviewForm';
import { UserReviewList } from './UserReviewList';
import { TagSuggestionForm } from './TagSuggestionForm';
import { TagSuggestionList } from './TagSuggestionList';
import { PerformerSuggestionForm } from './PerformerSuggestionForm';
import { PerformerSuggestionList } from './PerformerSuggestionList';

export interface UserContributionsSectionTranslations {
  sectionTitle: string;
  reviewForm: {
    title: string;
    loginRequired: string;
    ratingLabel: string;
    reviewTitleLabel: string;
    reviewTitlePlaceholder: string;
    contentLabel: string;
    contentPlaceholder: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    alreadyReviewed: string;
    minLength: string;
  };
  reviewList: {
    title: string;
    noReviews: string;
    helpful: string;
    notHelpful: string;
    helpfulCount: string;
    loading: string;
    error: string;
  };
  tagForm: {
    title: string;
    loginRequired: string;
    placeholder: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    alreadySuggested: string;
    tooShort: string;
  };
  tagList: {
    title: string;
    noSuggestions: string;
    approved: string;
    pending: string;
    loginToVote: string;
  };
  performerForm: {
    title: string;
    loginRequired: string;
    placeholder: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    alreadySuggested: string;
    tooShort: string;
    selectExisting: string;
    orEnterNew: string;
  };
  performerList: {
    title: string;
    noSuggestions: string;
    approved: string;
    pending: string;
    linkedToExisting: string;
    loginToVote: string;
  };
}

interface UserContributionsSectionProps {
  productId: number;
  userId: string | null;
  existingTags?: string[];
  existingPerformers?: string[];
  onLoginRequired?: () => void;
  translations: UserContributionsSectionTranslations;
  defaultExpanded?: boolean;
}

export function UserContributionsSection({
  productId,
  userId,
  existingTags = [],
  existingPerformers = [],
  onLoginRequired,
  translations: t,
  defaultExpanded = false,
}: UserContributionsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [reviewKey, setReviewKey] = useState(0);
  const [tagKey, setTagKey] = useState(0);
  const [performerKey, setPerformerKey] = useState(0);

  const handleReviewSuccess = () => {
    setReviewKey((k) => k + 1);
  };

  const handleTagSuccess = () => {
    setTagKey((k) => k + 1);
  };

  const handlePerformerSuccess = () => {
    setPerformerKey((k) => k + 1);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
            <Users className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{t.sectionTitle}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-6">
          {/* Reviews Section */}
          <div className="space-y-4">
            <UserReviewForm
              productId={productId}
              userId={userId}
              onSuccess={handleReviewSuccess}
              {...(onLoginRequired !== undefined && { onLoginRequired })}
              translations={t.reviewForm}
            />
            <UserReviewList
              key={reviewKey}
              productId={productId}
              userId={userId}
              translations={t.reviewList}
            />
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Tag Suggestions Section */}
          <div className="space-y-4">
            <TagSuggestionForm
              productId={productId}
              userId={userId}
              existingTags={existingTags}
              onSuccess={handleTagSuccess}
              {...(onLoginRequired !== undefined && { onLoginRequired })}
              translations={t.tagForm}
            />
            <TagSuggestionList
              key={tagKey}
              productId={productId}
              userId={userId}
              {...(onLoginRequired !== undefined && { onLoginRequired })}
              translations={t.tagList}
            />
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Performer Suggestions Section */}
          <div className="space-y-4">
            <PerformerSuggestionForm
              productId={productId}
              userId={userId}
              existingPerformers={existingPerformers}
              onSuccess={handlePerformerSuccess}
              {...(onLoginRequired !== undefined && { onLoginRequired })}
              translations={t.performerForm}
            />
            <PerformerSuggestionList
              key={performerKey}
              productId={productId}
              userId={userId}
              {...(onLoginRequired !== undefined && { onLoginRequired })}
              translations={t.performerList}
            />
          </div>
        </div>
      )}
    </div>
  );
}
