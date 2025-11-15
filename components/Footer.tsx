import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* サイト情報 */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">ADULT VIEWER LAB</h3>
            <p className="text-sm text-gray-400">
              DMM / APEX / SOKMIL / DTIの4プラットフォームを横断し、
              ヘビー視聴者が欲しい女優ベースの情報を整理しています。
            </p>
          </div>

          {/* カテゴリ */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">カテゴリ</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/categories?category=premium" className="hover:text-white transition-colors">
                  王道・人気女優
                </Link>
              </li>
              <li>
                <Link href="/categories?category=mature" className="hover:text-white transition-colors">
                  人妻・熟女
                </Link>
              </li>
              <li>
                <Link href="/categories?category=vr" className="hover:text-white transition-colors">
                  VR・4K
                </Link>
              </li>
              <li>
                <Link href="/categories?category=fetish" className="hover:text-white transition-colors">
                  マニアック
                </Link>
              </li>
            </ul>
          </div>

          {/* リンク */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">リンク</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  ホーム
                </Link>
              </li>
              <li>
                <Link href="/actresses" className="hover:text-white transition-colors">
                  女優図鑑
                </Link>
              </li>
              <li>
                <Link href="/featured" className="hover:text-white transition-colors">
                  レビュー
                </Link>
              </li>
              <li>
                <Link href="/new" className="hover:text-white transition-colors">
                  キャンペーン
                </Link>
              </li>
            </ul>
          </div>

          {/* その他 */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">その他</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://affiliate.dmm.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  DMMアフィリエイト
                </a>
              </li>
              <li>
                <a
                  href="https://www.apex-pictures.com/affiliate/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  APEXアフィリエイト
                </a>
              </li>
              <li>
                <a
                  href="https://www.sokmil.com/affiliate/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  SOKMILアフィリエイト
                </a>
              </li>
              <li>
                <a
                  href="https://dream.jp/asp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  DTIアフィリエイト
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* コピーライト */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Adult Viewer Lab. All rights reserved.</p>
          <p className="mt-2">
            ※本サイトはDMM / APEX / SOKMIL / DTIの各アフィリエイトプログラムを利用しています。各社の規約を遵守のうえ運用しています。
          </p>
        </div>
      </div>
    </footer>
  );
}
