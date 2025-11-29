import Link from 'next/link';
import { DugaCredit } from './credits/DugaCredit';
import { SokmilCredit } from './credits/SokmilCredit';
import { MgsCredit } from './credits/MgsCredit';
import { DtiCredit } from './credits/DtiCredit';
import { B10fCredit } from './credits/B10fCredit';
import { Fc2Credit } from './credits/Fc2Credit';
import { JapanskaCredit } from './credits/JapanskaCredit';

export default function Footer({ locale = 'ja' }: { locale?: string }) {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="container mx-auto px-4 py-8">
        {/* サイト情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-2">ADULT VIEWER LAB</h3>
            <p className="text-sm text-gray-400">
              複数のプラットフォームを横断し、
              ヘビー視聴者が欲しい女優ベースの情報を整理しています。
            </p>
          </div>

          {/* 法的ページリンク */}
          <div>
            <h4 className="text-white font-semibold mb-3">サイトポリシー</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/privacy`} className="text-gray-400 hover:text-white transition-colors">
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="text-gray-400 hover:text-white transition-colors">
                  利用規約
                </Link>
              </li>
            </ul>
          </div>

          {/* お問い合わせ */}
          <div>
            <h4 className="text-white font-semibold mb-3">お問い合わせ</h4>
            <p className="text-sm text-gray-400">
              ご質問・ご要望はメールにてお問い合わせください。
            </p>
            <a
              href="mailto:adult.vvvv@gmail.com"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              adult.vvvv@gmail.com
            </a>
          </div>
        </div>

        {/* アフィリエイト開示 */}
        <div className="border-t border-gray-800 mt-8 pt-6 text-xs text-gray-500">
          <p className="leading-relaxed">
            当サイトはDUGA、MGS、ソクミル、DTI、B10F.jp、FC2、Japanskaなどのアフィリエイトプログラムに参加しています。
            商品リンクから購入された場合、紹介料が発生することがあります。
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
          <a
            href="/admin/stats"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            管理ページ
          </a>
          <span className="hidden md:inline">|</span>
          <p>&copy; {new Date().getFullYear()} Adult Viewer Lab. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
