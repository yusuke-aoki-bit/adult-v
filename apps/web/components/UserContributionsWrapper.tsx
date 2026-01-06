'use client';

import { UserContributionsSection } from '@adult-v/shared/components';
import { useFirebaseAuth } from '@adult-v/shared/contexts';
import type { UserContributionsSectionTranslations } from '@adult-v/shared/components';

// 翻訳定義
const translations: Record<string, UserContributionsSectionTranslations> = {
  ja: {
    sectionTitle: 'ユーザー投稿',
    reviewForm: {
      title: 'レビューを投稿',
      loginRequired: 'レビューを投稿するにはログインが必要です',
      ratingLabel: '評価（必須）',
      reviewTitleLabel: 'タイトル（任意）',
      reviewTitlePlaceholder: 'レビューのタイトルを入力',
      contentLabel: 'レビュー内容（必須）',
      contentPlaceholder: '作品の感想を書いてください...',
      submit: '投稿する',
      submitting: '投稿中...',
      success: 'レビューが投稿されました！',
      error: '投稿に失敗しました',
      alreadyReviewed: 'この作品には既にレビューを投稿しています',
      minLength: 'レビュー内容は10文字以上入力してください',
    },
    reviewList: {
      title: 'ユーザーレビュー',
      noReviews: 'まだレビューがありません。最初のレビューを投稿してみましょう！',
      helpful: '参考になった',
      notHelpful: '参考にならなかった',
      helpfulCount: '{count}人が参考になったと評価',
      loading: 'レビューを読み込み中...',
      error: 'レビューの読み込みに失敗しました',
    },
    tagForm: {
      title: 'タグを提案',
      loginRequired: 'タグを提案するにはログインが必要です',
      placeholder: 'タグ名を入力（例: 巨乳、素人）',
      submit: '提案する',
      submitting: '送信中...',
      success: 'タグが提案されました！',
      error: '提案に失敗しました',
      alreadySuggested: 'このタグは既に提案されています',
      tooShort: 'タグ名は2文字以上入力してください',
    },
    tagList: {
      title: 'ユーザー提案タグ',
      noSuggestions: 'まだタグの提案がありません',
      approved: '承認済み',
      pending: '審査中',
      loginToVote: 'ログインして投票',
    },
    performerForm: {
      title: '出演者を提案',
      loginRequired: '出演者を提案するにはログインが必要です',
      placeholder: '出演者名を入力',
      submit: '提案する',
      submitting: '送信中...',
      success: '出演者が提案されました！',
      error: '提案に失敗しました',
      alreadySuggested: 'この出演者は既に提案されています',
      tooShort: '出演者名は2文字以上入力してください',
      selectExisting: '既存の出演者から選択',
      orEnterNew: 'または新しい出演者名を入力',
    },
    performerList: {
      title: 'ユーザー提案出演者',
      noSuggestions: 'まだ出演者の提案がありません',
      approved: '承認済み',
      pending: '審査中',
      linkedToExisting: '既存の出演者と紐付け済み',
      loginToVote: 'ログインして投票',
    },
  },
  en: {
    sectionTitle: 'User Contributions',
    reviewForm: {
      title: 'Write a Review',
      loginRequired: 'Please login to write a review',
      ratingLabel: 'Rating (required)',
      reviewTitleLabel: 'Title (optional)',
      reviewTitlePlaceholder: 'Enter a title for your review',
      contentLabel: 'Review (required)',
      contentPlaceholder: 'Share your thoughts about this video...',
      submit: 'Submit',
      submitting: 'Submitting...',
      success: 'Review submitted successfully!',
      error: 'Failed to submit review',
      alreadyReviewed: 'You have already reviewed this video',
      minLength: 'Review must be at least 10 characters',
    },
    reviewList: {
      title: 'User Reviews',
      noReviews: 'No reviews yet. Be the first to write one!',
      helpful: 'Helpful',
      notHelpful: 'Not helpful',
      helpfulCount: '{count} found this helpful',
      loading: 'Loading reviews...',
      error: 'Failed to load reviews',
    },
    tagForm: {
      title: 'Suggest a Tag',
      loginRequired: 'Please login to suggest a tag',
      placeholder: 'Enter tag name',
      submit: 'Suggest',
      submitting: 'Submitting...',
      success: 'Tag suggestion submitted!',
      error: 'Failed to submit suggestion',
      alreadySuggested: 'This tag has already been suggested',
      tooShort: 'Tag name must be at least 2 characters',
    },
    tagList: {
      title: 'User Suggested Tags',
      noSuggestions: 'No tag suggestions yet',
      approved: 'Approved',
      pending: 'Under Review',
      loginToVote: 'Login to vote',
    },
    performerForm: {
      title: 'Suggest a Performer',
      loginRequired: 'Please login to suggest a performer',
      placeholder: 'Enter performer name',
      submit: 'Suggest',
      submitting: 'Submitting...',
      success: 'Performer suggestion submitted!',
      error: 'Failed to submit suggestion',
      alreadySuggested: 'This performer has already been suggested',
      tooShort: 'Performer name must be at least 2 characters',
      selectExisting: 'Select from existing performers',
      orEnterNew: 'Or enter a new performer name',
    },
    performerList: {
      title: 'User Suggested Performers',
      noSuggestions: 'No performer suggestions yet',
      approved: 'Approved',
      pending: 'Under Review',
      linkedToExisting: 'Linked to existing performer',
      loginToVote: 'Login to vote',
    },
  },
  zh: {
    sectionTitle: '用户贡献',
    reviewForm: {
      title: '发表评论',
      loginRequired: '请登录后发表评论',
      ratingLabel: '评分（必填）',
      reviewTitleLabel: '标题（选填）',
      reviewTitlePlaceholder: '输入评论标题',
      contentLabel: '评论内容（必填）',
      contentPlaceholder: '分享您对这部作品的看法...',
      submit: '提交',
      submitting: '提交中...',
      success: '评论已提交！',
      error: '提交失败',
      alreadyReviewed: '您已经评论过这部作品',
      minLength: '评论内容至少需要10个字符',
    },
    reviewList: {
      title: '用户评论',
      noReviews: '暂无评论，成为第一个评论者吧！',
      helpful: '有帮助',
      notHelpful: '没有帮助',
      helpfulCount: '{count}人觉得有帮助',
      loading: '加载评论中...',
      error: '加载评论失败',
    },
    tagForm: {
      title: '建议标签',
      loginRequired: '请登录后建议标签',
      placeholder: '输入标签名称',
      submit: '建议',
      submitting: '提交中...',
      success: '标签建议已提交！',
      error: '提交失败',
      alreadySuggested: '此标签已被建议',
      tooShort: '标签名称至少需要2个字符',
    },
    tagList: {
      title: '用户建议标签',
      noSuggestions: '暂无标签建议',
      approved: '已批准',
      pending: '审核中',
      loginToVote: '登录后投票',
    },
    performerForm: {
      title: '建议演员',
      loginRequired: '请登录后建议演员',
      placeholder: '输入演员名称',
      submit: '建议',
      submitting: '提交中...',
      success: '演员建议已提交！',
      error: '提交失败',
      alreadySuggested: '此演员已被建议',
      tooShort: '演员名称至少需要2个字符',
      selectExisting: '从现有演员中选择',
      orEnterNew: '或输入新演员名称',
    },
    performerList: {
      title: '用户建议演员',
      noSuggestions: '暂无演员建议',
      approved: '已批准',
      pending: '审核中',
      linkedToExisting: '已关联现有演员',
      loginToVote: '登录后投票',
    },
  },
  ko: {
    sectionTitle: '사용자 기여',
    reviewForm: {
      title: '리뷰 작성',
      loginRequired: '리뷰를 작성하려면 로그인이 필요합니다',
      ratingLabel: '평점 (필수)',
      reviewTitleLabel: '제목 (선택)',
      reviewTitlePlaceholder: '리뷰 제목을 입력하세요',
      contentLabel: '리뷰 내용 (필수)',
      contentPlaceholder: '이 작품에 대한 생각을 공유해주세요...',
      submit: '제출',
      submitting: '제출 중...',
      success: '리뷰가 제출되었습니다!',
      error: '제출에 실패했습니다',
      alreadyReviewed: '이미 이 작품에 리뷰를 작성하셨습니다',
      minLength: '리뷰 내용은 최소 10자 이상이어야 합니다',
    },
    reviewList: {
      title: '사용자 리뷰',
      noReviews: '아직 리뷰가 없습니다. 첫 리뷰를 작성해보세요!',
      helpful: '도움이 됨',
      notHelpful: '도움이 안 됨',
      helpfulCount: '{count}명이 도움이 되었다고 평가',
      loading: '리뷰 로딩 중...',
      error: '리뷰 로딩에 실패했습니다',
    },
    tagForm: {
      title: '태그 제안',
      loginRequired: '태그를 제안하려면 로그인이 필요합니다',
      placeholder: '태그 이름을 입력하세요',
      submit: '제안',
      submitting: '제출 중...',
      success: '태그 제안이 제출되었습니다!',
      error: '제출에 실패했습니다',
      alreadySuggested: '이 태그는 이미 제안되었습니다',
      tooShort: '태그 이름은 최소 2자 이상이어야 합니다',
    },
    tagList: {
      title: '사용자 제안 태그',
      noSuggestions: '아직 태그 제안이 없습니다',
      approved: '승인됨',
      pending: '검토 중',
      loginToVote: '투표하려면 로그인',
    },
    performerForm: {
      title: '출연자 제안',
      loginRequired: '출연자를 제안하려면 로그인이 필요합니다',
      placeholder: '출연자 이름을 입력하세요',
      submit: '제안',
      submitting: '제출 중...',
      success: '출연자 제안이 제출되었습니다!',
      error: '제출에 실패했습니다',
      alreadySuggested: '이 출연자는 이미 제안되었습니다',
      tooShort: '출연자 이름은 최소 2자 이상이어야 합니다',
      selectExisting: '기존 출연자 중 선택',
      orEnterNew: '또는 새 출연자 이름 입력',
    },
    performerList: {
      title: '사용자 제안 출연자',
      noSuggestions: '아직 출연자 제안이 없습니다',
      approved: '승인됨',
      pending: '검토 중',
      linkedToExisting: '기존 출연자와 연결됨',
      loginToVote: '투표하려면 로그인',
    },
  },
};

interface UserContributionsWrapperProps {
  productId: number;
  locale: string;
  existingTags?: string[];
  existingPerformers?: string[];
}

export default function UserContributionsWrapper({
  productId,
  locale,
  existingTags = [],
  existingPerformers = [],
}: UserContributionsWrapperProps) {
  const { user, linkGoogle } = useFirebaseAuth();
  const t = translations[locale] || translations['ja'];

  const handleLoginRequired = () => {
    // Googleログインをトリガー
    linkGoogle();
  };

  return (
    <UserContributionsSection
      productId={productId}
      userId={user?.uid || null}
      existingTags={existingTags}
      existingPerformers={existingPerformers}
      onLoginRequired={handleLoginRequired}
      translations={t}
      defaultExpanded={false}
    />
  );
}
