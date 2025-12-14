'use client';

// Footer用翻訳（FANZA専用サイト版）
export const footerTranslations = {
  ja: {
    siteName: 'AVVIEWER LAB',
    description: 'FANZA作品の検索・比較サービス。女優情報、ランキング、セール情報をヘビー視聴者向けに整理しています。',
    legal: 'サイトポリシー',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    contact: 'お問い合わせ',
    contactDescription: 'ご質問・ご要望はメールにてお問い合わせください。',
    copyrightNotice: '当サイトはFANZAから収集した情報を表示しています。すべての画像・動画コンテンツの著作権は各権利者に帰属します。当サイトはFANZA/DMMの公式サービスではありません。',
    disclaimer2257: '18 U.S.C. § 2257 免責: 当サイトはコンテンツの制作者ではありません。すべてのコンテンツは第三者のプラットフォームから提供されており、各プラットフォームが記録保持の責任を負います。',
    admin: '管理ページ',
    copyright: '© {year} AVVIEWER LAB. All rights reserved.',
  },
  en: {
    siteName: 'AVVIEWER LAB',
    description: 'FANZA product search and comparison service with actress information, rankings, and sale updates for heavy users.',
    legal: 'Site Policies',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact',
    contactDescription: 'For questions or requests, please contact us by email.',
    copyrightNotice: 'This site displays information collected from FANZA. All image and video content copyrights belong to their respective owners. This site is NOT affiliated with FANZA/DMM.',
    disclaimer2257: '18 U.S.C. § 2257 Exemption: This site is not the producer of any content. All content is provided by third-party platforms, which are responsible for record-keeping compliance.',
    admin: 'Admin',
    copyright: '© {year} AVVIEWER LAB. All rights reserved.',
  },
  zh: {
    siteName: 'AVVIEWER LAB',
    description: 'FANZA作品搜索和比较服务，提供女优信息、排行榜和促销活动更新。',
    legal: '网站政策',
    privacy: '隐私政策',
    terms: '服务条款',
    contact: '联系我们',
    contactDescription: '如有问题或需求，请通过电子邮件联系我们。',
    copyrightNotice: '本站展示从FANZA收集的信息。所有图片和视频内容的版权归各权利人所有。本站与FANZA/DMM无关联。',
    disclaimer2257: '18 U.S.C. § 2257 免责声明：本站不是任何内容的制作者。所有内容均由第三方平台提供，各平台负责记录保存合规。',
    admin: '管理页面',
    copyright: '© {year} AVVIEWER LAB. 保留所有权利。',
  },
  ko: {
    siteName: 'AVVIEWER LAB',
    description: 'FANZA 작품 검색 및 비교 서비스로, 여배우 정보, 랭킹 및 세일 정보를 제공합니다.',
    legal: '사이트 정책',
    privacy: '개인정보 처리방침',
    terms: '이용약관',
    contact: '문의',
    contactDescription: '질문이나 요청 사항은 이메일로 문의해 주세요.',
    copyrightNotice: '이 사이트는 FANZA에서 수집한 정보를 표시합니다. 모든 이미지 및 동영상 콘텐츠의 저작권은 각 권리자에게 있습니다. 이 사이트는 FANZA/DMM과 관련이 없습니다.',
    disclaimer2257: '18 U.S.C. § 2257 면책: 이 사이트는 콘텐츠 제작자가 아닙니다. 모든 콘텐츠는 제3자 플랫폼에서 제공되며, 각 플랫폼이 기록 보관 규정 준수를 담당합니다.',
    admin: '관리 페이지',
    copyright: '© {year} AVVIEWER LAB. All rights reserved.',
  },
} as const;

export type FooterTranslationKey = keyof typeof footerTranslations;
export type FooterTranslation = typeof footerTranslations[FooterTranslationKey];

export function getFooterTranslation(locale: string): FooterTranslation {
  return footerTranslations[locale as FooterTranslationKey] || footerTranslations.ja;
}
