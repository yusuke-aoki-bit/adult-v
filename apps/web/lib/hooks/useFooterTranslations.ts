'use client';

// Footer用翻訳（サイト共通部分）
export const footerTranslations = {
  ja: {
    siteName: 'ADULT VIEWER LAB',
    description: '複数のプラットフォームを横断し、ヘビー視聴者が欲しい女優ベースの情報を整理しています。',
    legal: 'サイトポリシー',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    contact: 'お問い合わせ',
    contactDescription: 'ご質問・ご要望はメールにてお問い合わせください。',
    affiliateNotice: '当サイトはDUGA、MGS、ソクミル、DTI、B10F.jp、FC2、Japanskaなどのアフィリエイトプログラムに参加しています。商品リンクから購入された場合、紹介料が発生することがあります。',
    disclaimer2257: '18 U.S.C. § 2257 免責: 当サイトはコンテンツの制作者ではありません。すべてのコンテンツは第三者のプラットフォームから提供されており、各プラットフォームが記録保持の責任を負います。',
    admin: '管理ページ',
    copyright: '© {year} Adult Viewer Lab. All rights reserved.',
  },
  en: {
    siteName: 'ADULT VIEWER LAB',
    description: 'Cross-platform adult streaming hub covering DUGA / SOKMIL / DTI with actress-based reviews, rankings, and campaign updates for heavy users.',
    legal: 'Site Policies',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact',
    contactDescription: 'For questions or requests, please contact us by email.',
    affiliateNotice: 'This site participates in affiliate programs with DUGA, MGS, SOKMIL, DTI, B10F.jp, FC2, and Japanska. We may earn commissions from purchases made through product links.',
    disclaimer2257: '18 U.S.C. § 2257 Exemption: This site is not the producer of any content. All content is provided by third-party platforms, which are responsible for record-keeping compliance.',
    admin: 'Admin',
    copyright: '© {year} Adult Viewer Lab. All rights reserved.',
  },
  zh: {
    siteName: 'ADULT VIEWER LAB',
    description: '跨平台成人流媒体中心，涵盖DUGA / SOKMIL / DTI，提供女优评论、排行榜和重度用户活动更新。',
    legal: '网站政策',
    privacy: '隐私政策',
    terms: '服务条款',
    contact: '联系我们',
    contactDescription: '如有问题或需求，请通过电子邮件联系我们。',
    affiliateNotice: '本站参与DUGA、MGS、SOKMIL、DTI、B10F.jp、FC2和Japanska的联盟计划。通过产品链接购买可能会产生佣金。',
    disclaimer2257: '18 U.S.C. § 2257 免责声明：本站不是任何内容的制作者。所有内容均由第三方平台提供，各平台负责记录保存合规。',
    admin: '管理页面',
    copyright: '© {year} Adult Viewer Lab. 保留所有权利。',
  },
  ko: {
    siteName: 'ADULT VIEWER LAB',
    description: 'DUGA / SOKMIL / DTI를 아우르는 크로스 플랫폼 성인 스트리밍 허브로, 헤비 유저를 위한 여배우 기반 리뷰, 랭킹 및 캠페인 업데이트를 제공합니다.',
    legal: '사이트 정책',
    privacy: '개인정보 처리방침',
    terms: '이용약관',
    contact: '문의',
    contactDescription: '질문이나 요청 사항은 이메일로 문의해 주세요.',
    affiliateNotice: '이 사이트는 DUGA, MGS, SOKMIL, DTI, B10F.jp, FC2, Japanska와의 제휴 프로그램에 참여하고 있습니다. 상품 링크를 통한 구매 시 수수료가 발생할 수 있습니다.',
    disclaimer2257: '18 U.S.C. § 2257 면책: 이 사이트는 콘텐츠 제작자가 아닙니다. 모든 콘텐츠는 제3자 플랫폼에서 제공되며, 각 플랫폼이 기록 보관 규정 준수를 담당합니다.',
    admin: '관리 페이지',
    copyright: '© {year} Adult Viewer Lab. All rights reserved.',
  },
} as const;

export type FooterTranslationKey = keyof typeof footerTranslations;
export type FooterTranslation = typeof footerTranslations[FooterTranslationKey];

export function getFooterTranslation(locale: string): FooterTranslation {
  return footerTranslations[locale as FooterTranslationKey] || footerTranslations.ja;
}
