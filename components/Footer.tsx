import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* サイト情報 */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">ADULT VIEWER LAB</h3>
            <p className="text-sm text-gray-400">
              DMM / DUGA / SOKMIL / DTIの4プラットフォームを横断し、
              ヘビー視聴者が欲しい女優ベースの情報を整理しています。
            </p>
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
            </ul>
          </div>
        </div>

        {/* コピーライト */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Adult Viewer Lab. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
