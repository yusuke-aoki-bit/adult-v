'use client';

import Link from 'next/link';
import { DugaCredit } from './credits/DugaCredit';
import { SokmilCredit } from './credits/SokmilCredit';
import { MgsCredit } from './credits/MgsCredit';
import { DtiCredit } from './credits/DtiCredit';
import { B10fCredit } from './credits/B10fCredit';
import { Fc2Credit } from './credits/Fc2Credit';
import { JapanskaCredit } from './credits/JapanskaCredit';

// Client-side translations (ConditionalLayout is outside NextIntlClientProvider)
const translations = {
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

export default function Footer({ locale = 'ja' }: { locale?: string }) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto min-h-[400px]">
      <div className="container mx-auto px-4 py-8">
        {/* サイト情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-2">{t.siteName}</h3>
            <p className="text-sm text-gray-400">
              {t.description}
            </p>
          </div>

          {/* 法的ページリンク */}
          <div>
            <h4 className="text-white font-semibold mb-3">{t.legal}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/privacy`} className="text-gray-400 hover:text-white transition-colors">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="text-gray-400 hover:text-white transition-colors">
                  {t.terms}
                </Link>
              </li>
            </ul>
          </div>

          {/* お問い合わせ */}
          <div>
            <h4 className="text-white font-semibold mb-3">{t.contact}</h4>
            <p className="text-sm text-gray-400">
              {t.contactDescription}
            </p>
            <a
              href="mailto:adult.vvvv@gmail.com"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              adult.vvvv@gmail.com
            </a>
          </div>
        </div>

        {/* アフィリエイト開示 & 2257免責 */}
        <div className="border-t border-gray-800 mt-8 pt-6 text-xs text-gray-500 space-y-3">
          <p className="leading-relaxed">
            {t.affiliateNotice}
          </p>
          <p className="leading-relaxed">
            {t.disclaimer2257}
          </p>
        </div>

        {/* パートナーバナー表示 */}
        <div className="border-t border-gray-800 mt-6 pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 items-center justify-items-center">
            <DugaCredit />
            <SokmilCredit variant="88x31" />
            <MgsCredit />
            <DtiCredit />
            <B10fCredit />
            <Fc2Credit />
            <JapanskaCredit />
          </div>
        </div>

        {/* 管理ページ・コピーライト */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-gray-500">
          <Link
            href="/admin/stats"
            className="text-gray-500 hover:text-gray-300 transition-colors"
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
