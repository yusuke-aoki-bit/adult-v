/**
 * アフィリエイト開示コンポーネント
 * アフィリエイトリンクの使用を明示する
 */
export default function AffiliateDisclosure() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
      <h3 className="font-semibold text-gray-900 mb-2">アフィリエイトプログラムについて</h3>
      <p className="leading-relaxed">
        当サイトは、DMM、DUGA、SOKMIL、DTIのアフィリエイトプログラムに参加しています。
        掲載されている商品リンクをクリックして購入された場合、当サイトに紹介料が支払われることがあります。
        紹介料の有無や金額によって商品の掲載順位やレビュー内容が影響を受けることはありません。
      </p>
    </div>
  );
}
