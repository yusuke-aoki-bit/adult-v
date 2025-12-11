'use client';

import Link from 'next/link';

// Client-side translations (ConditionalLayout is outside NextIntlClientProvider)
const translations = {
  ja: {
    siteName: 'AV VIEWER LAB',
    description: '各プラットフォームの作品情報を整理し、ヘビー視聴者のための女優ベースの検索・比較サービスを提供しています。',
    legal: 'サイトポリシー',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    contact: 'お問い合わせ',
    contactDescription: 'ご質問・ご要望はメールにてお問い合わせください。',
    affiliateNotice: '当サイトはDUGA、MGS、SOKMILなどのアフィリエイトプログラムに参加しています。商品リンクから購入された場合、紹介料が発生することがあります。',
    copyrightNotice: '当サイトは各プラットフォームから収集した情報を表示しています。すべての画像・動画コンテンツの著作権は各権利者に帰属します。当サイトはFANZA/DMMの公式サービスではありません。',
    disclaimer2257: '18 U.S.C. § 2257 免責: 当サイトはコンテンツの制作者ではありません。すべてのコンテンツは第三者のプラットフォームから提供されており、各プラットフォームが記録保持の責任を負います。',
    admin: '管理ページ',
    copyright: '© {year} AV VIEWER LAB. All rights reserved.',
  },
  en: {
    siteName: 'AV VIEWER LAB',
    description: 'AV product search and comparison service with actress-based reviews, rankings, and campaign updates for heavy users.',
    legal: 'Site Policies',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact',
    contactDescription: 'For questions or requests, please contact us by email.',
    affiliateNotice: 'This site participates in affiliate programs of DUGA, MGS, SOKMIL and others. We may earn commissions from purchases made through product links.',
    copyrightNotice: 'This site displays information collected from various platforms. All image and video content copyrights belong to their respective owners. This site is NOT affiliated with FANZA/DMM.',
    disclaimer2257: '18 U.S.C. § 2257 Exemption: This site is not the producer of any content. All content is provided by third-party platforms, which are responsible for record-keeping compliance.',
    admin: 'Admin',
    copyright: '© {year} AV VIEWER LAB. All rights reserved.',
  },
  zh: {
    siteName: 'AV VIEWER LAB',
    description: 'AV作品搜索和比较服务，提供女优评论、排行榜和重度用户活动更新。',
    legal: '网站政策',
    privacy: '隐私政策',
    terms: '服务条款',
    contact: '联系我们',
    contactDescription: '如有问题或需求，请通过电子邮件联系我们。',
    affiliateNotice: '本站参与DUGA、MGS、SOKMIL等的联盟计划。通过产品链接购买可能会产生佣金。',
    copyrightNotice: '本站展示从各平台收集的信息。所有图片和视频内容的版权归各权利人所有。本站与FANZA/DMM无关联。',
    disclaimer2257: '18 U.S.C. § 2257 免责声明：本站不是任何内容的制作者。所有内容均由第三方平台提供，各平台负责记录保存合规。',
    admin: '管理页面',
    copyright: '© {year} AV VIEWER LAB. 保留所有权利。',
  },
  ko: {
    siteName: 'AV VIEWER LAB',
    description: 'AV 작품 검색 및 비교 서비스로, 헤비 유저를 위한 여배우 기반 리뷰, 랭킹 및 캠페인 업데이트를 제공합니다.',
    legal: '사이트 정책',
    privacy: '개인정보 처리방침',
    terms: '이용약관',
    contact: '문의',
    contactDescription: '질문이나 요청 사항은 이메일로 문의해 주세요.',
    affiliateNotice: '이 사이트는 DUGA, MGS, SOKMIL 등의 제휴 프로그램에 참여하고 있습니다. 상품 링크를 통한 구매 시 수수료가 발생할 수 있습니다.',
    copyrightNotice: '이 사이트는 각 플랫폼에서 수집한 정보를 표시합니다. 모든 이미지 및 동영상 콘텐츠의 저작권은 각 권리자에게 있습니다. 이 사이트는 FANZA/DMM과 관련이 없습니다.',
    disclaimer2257: '18 U.S.C. § 2257 면책: 이 사이트는 콘텐츠 제작자가 아닙니다. 모든 콘텐츠는 제3자 플랫폼에서 제공되며, 각 플랫폼이 기록 보관 규정 준수를 담당합니다.',
    admin: '관리 페이지',
    copyright: '© {year} AV VIEWER LAB. All rights reserved.',
  },
} as const;

export default function Footer({ locale = 'ja' }: { locale?: string }) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  return (
    <footer className="theme-footer border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        {/* サイト情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h2 className="theme-footer-heading font-bold text-lg mb-2">{t.siteName}</h2>
            <p className="text-sm theme-footer-link">
              {t.description}
            </p>
          </div>

          {/* 法的ページリンク */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">{t.legal}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/privacy`} className="theme-footer-link transition-colors">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="theme-footer-link transition-colors">
                  {t.terms}
                </Link>
              </li>
            </ul>
          </div>

          {/* お問い合わせ */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">{t.contact}</h3>
            <p className="text-sm theme-footer-link">
              {t.contactDescription}
            </p>
            <a
              href="mailto:adult.vvvv@gmail.com"
              className="text-sm theme-footer-email transition-colors"
            >
              adult.vvvv@gmail.com
            </a>
          </div>
        </div>

        {/* アフィリエイト開示 & 著作権遵守 & 2257免責 */}
        <div className="border-t theme-footer-border mt-8 pt-6 text-xs space-y-3">
          <p className="leading-relaxed theme-footer-link">
            {t.affiliateNotice}
          </p>
          <p className="leading-relaxed theme-footer-link">
            {t.copyrightNotice}
          </p>
          <p className="leading-relaxed theme-footer-link">
            {t.disclaimer2257}
          </p>
        </div>

        {/* 管理ページ・コピーライト */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 text-sm">
          <Link
            href="/admin/stats"
            className="theme-footer-link transition-colors"
          >
            {t.admin}
          </Link>
          <span className="hidden md:inline">|</span>
          <p>{t.copyright.replace('{year}', String(new Date().getFullYear()))}</p>
        </div>
      </div>
    </footer>
  );
}
