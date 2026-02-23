/**
 * ASP名正規化ユーティリティのテスト
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeAspName,
  getAspDisplayName,
  isValidAspName,
  isDtiSubService,
  getAspBadgeColor,
  DTI_URL_PATTERNS,
  JA_TO_EN_MAP,
  UPPER_TO_LOWER_MAP,
  ASP_DISPLAY_NAMES,
  VALID_ASP_NAMES,
  buildDtiUrlCaseParts,
  buildJaToEnCaseParts,
  buildUpperToLowerCaseParts,
  buildAspNormalizationSql,
  buildAspMatchSql,
} from '@adult-v/shared/lib/asp-utils';

describe('asp-utils', () => {
  describe('normalizeAspName', () => {
    describe('大文字ASP名の正規化', () => {
      it('FANZAをfanzaに変換', () => {
        expect(normalizeAspName('FANZA')).toBe('fanza');
      });

      it('MGSをmgsに変換', () => {
        expect(normalizeAspName('MGS')).toBe('mgs');
      });

      it('DUGAをdugaに変換', () => {
        expect(normalizeAspName('DUGA')).toBe('duga');
      });

      it('SOKMILをsokmilに変換', () => {
        expect(normalizeAspName('SOKMIL')).toBe('sokmil');
      });

      it('FC2をfc2に変換', () => {
        expect(normalizeAspName('FC2')).toBe('fc2');
      });

      it('JAPANSKAをjapanskaに変換', () => {
        expect(normalizeAspName('JAPANSKA')).toBe('japanska');
      });

      it('Japanskaをjapanskaに変換', () => {
        expect(normalizeAspName('Japanska')).toBe('japanska');
      });
    });

    describe('日本語ASP名の正規化', () => {
      it('カリビアンコムをcaribbeancmに変換', () => {
        expect(normalizeAspName('カリビアンコム')).toBe('caribbeancom');
      });

      it('カリビアンコムプレミアムをcaribbeancmprに変換', () => {
        expect(normalizeAspName('カリビアンコムプレミアム')).toBe('caribbeancompr');
      });

      it('カリビアンコムPRをcaribbeancomprに変換', () => {
        expect(normalizeAspName('カリビアンコムPR')).toBe('caribbeancompr');
      });

      it('一本道を1pondoに変換', () => {
        expect(normalizeAspName('一本道')).toBe('1pondo');
      });

      it('天然むすめを10musumeに変換', () => {
        expect(normalizeAspName('天然むすめ')).toBe('10musume');
      });

      it('パコパコママをpacopacomamaに変換', () => {
        expect(normalizeAspName('パコパコママ')).toBe('pacopacomama');
      });

      it('ムラムラをmuramuraに変換', () => {
        expect(normalizeAspName('ムラムラ')).toBe('muramura');
      });

      it('ムラムラってくる素人をmuramuraに変換', () => {
        expect(normalizeAspName('ムラムラってくる素人')).toBe('muramura');
      });

      it('Tokyo Hotをtokyohotに変換', () => {
        expect(normalizeAspName('Tokyo Hot')).toBe('tokyohot');
      });

      it('トウキョウホットをtokyohotに変換', () => {
        expect(normalizeAspName('トウキョウホット')).toBe('tokyohot');
      });
    });

    describe('DTI URL判定', () => {
      it('caribbeancom.comのURLからcaribbeancを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.caribbeancom.com/moviepages/123456-001/index.html')).toBe(
          'caribbeancom',
        );
      });

      it('caribbeancompr.comのURLからcaribbeancprを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.caribbeancompr.com/moviepages/123456-001/index.html')).toBe(
          'caribbeancompr',
        );
      });

      it('1pondo.tvのURLから1pondoを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.1pondo.tv/movies/123456_001/')).toBe('1pondo');
      });

      it('heyzo.comのURLからheyzoを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.heyzo.com/moviepages/1234/')).toBe('heyzo');
      });

      it('10musume.comのURLから10musumeを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.10musume.com/moviepages/123456_01/')).toBe('10musume');
      });

      it('pacopacomama.comのURLからpacopacomamaを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.pacopacomama.com/moviepages/123456_001/')).toBe('pacopacomama');
      });

      it('muramura.tvのURLからmuramuraを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.muramura.tv/moviepages/123456/')).toBe('muramura');
      });

      it('tokyo-hot.comのURLからtokyohotを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.tokyo-hot.com/e/n1234.html')).toBe('tokyohot');
      });

      it('heydouga.comのURLからheydougaを判定', () => {
        expect(normalizeAspName('DTI', 'https://www.heydouga.com/moviepages/1234-567/')).toBe('heydouga');
      });

      it('不明なDTI URLの場合はdtiを返す', () => {
        expect(normalizeAspName('DTI', 'https://unknown-dti-site.com/')).toBe('dti');
      });

      it('DTIでURLがない場合はdtiを返す', () => {
        expect(normalizeAspName('DTI')).toBe('dti');
      });
    });

    describe('既に正規化済みの名前', () => {
      it('fanzaはそのまま', () => {
        expect(normalizeAspName('fanza')).toBe('fanza');
      });

      it('mgsはそのまま', () => {
        expect(normalizeAspName('mgs')).toBe('mgs');
      });

      it('caribbeancomはそのまま', () => {
        expect(normalizeAspName('caribbeancom')).toBe('caribbeancom');
      });
    });

    describe('未知のASP名', () => {
      it('未知の名前は小文字化', () => {
        expect(normalizeAspName('UNKNOWN')).toBe('unknown');
      });

      it('混合ケースも小文字化', () => {
        expect(normalizeAspName('NewService')).toBe('newservice');
      });
    });
  });

  describe('getAspDisplayName', () => {
    it('fanzaからFANZAを取得', () => {
      expect(getAspDisplayName('fanza')).toBe('FANZA');
    });

    it('FANZAからFANZAを取得（正規化経由）', () => {
      expect(getAspDisplayName('FANZA')).toBe('FANZA');
    });

    it('mgsからMGS動画を取得', () => {
      expect(getAspDisplayName('mgs')).toBe('MGS動画');
    });

    it('caribbeancomからカリビアンコムを取得', () => {
      expect(getAspDisplayName('caribbeancom')).toBe('カリビアンコム');
    });

    it('caribbeancomprからカリビアンコムPRを取得', () => {
      expect(getAspDisplayName('caribbeancompr')).toBe('カリビアンコムPR');
    });

    it('1pondoから一本道を取得', () => {
      expect(getAspDisplayName('1pondo')).toBe('一本道');
    });

    it('10musumeから天然むすめを取得', () => {
      expect(getAspDisplayName('10musume')).toBe('天然むすめ');
    });

    it('tokyohotからTokyo Hotを取得', () => {
      expect(getAspDisplayName('tokyohot')).toBe('Tokyo Hot');
    });

    it('未知のASPは元の名前を返す', () => {
      expect(getAspDisplayName('unknownservice')).toBe('unknownservice');
    });
  });

  describe('isValidAspName', () => {
    it('有効なASP名でtrue', () => {
      expect(isValidAspName('fanza')).toBe(true);
      expect(isValidAspName('mgs')).toBe(true);
      expect(isValidAspName('duga')).toBe(true);
      expect(isValidAspName('sokmil')).toBe(true);
      expect(isValidAspName('fc2')).toBe(true);
      expect(isValidAspName('caribbeancom')).toBe(true);
      expect(isValidAspName('1pondo')).toBe(true);
      expect(isValidAspName('heyzo')).toBe(true);
      expect(isValidAspName('japanska')).toBe(true);
      expect(isValidAspName('b10f')).toBe(true);
    });

    it('大文字ASP名も有効', () => {
      expect(isValidAspName('FANZA')).toBe(true);
      expect(isValidAspName('MGS')).toBe(true);
      expect(isValidAspName('DUGA')).toBe(true);
    });

    it('日本語ASP名も有効', () => {
      expect(isValidAspName('カリビアンコム')).toBe(true);
      expect(isValidAspName('一本道')).toBe(true);
    });

    it('無効なASP名でfalse', () => {
      expect(isValidAspName('invalid')).toBe(false);
      expect(isValidAspName('unknown')).toBe(false);
      expect(isValidAspName('')).toBe(false);
    });
  });

  describe('isDtiSubService', () => {
    it('DTI系サービスでtrue', () => {
      expect(isDtiSubService('caribbeancom')).toBe(true);
      expect(isDtiSubService('caribbeancompr')).toBe(true);
      expect(isDtiSubService('1pondo')).toBe(true);
      expect(isDtiSubService('heyzo')).toBe(true);
      expect(isDtiSubService('10musume')).toBe(true);
      expect(isDtiSubService('pacopacomama')).toBe(true);
      expect(isDtiSubService('muramura')).toBe(true);
      expect(isDtiSubService('tokyohot')).toBe(true);
      expect(isDtiSubService('heydouga')).toBe(true);
      expect(isDtiSubService('dti')).toBe(true);
    });

    it('大文字でも判定可能', () => {
      expect(isDtiSubService('CARIBBEANCOM')).toBe(true);
      expect(isDtiSubService('HEYZO')).toBe(true);
    });

    it('日本語名でも判定可能', () => {
      expect(isDtiSubService('カリビアンコム')).toBe(true);
      expect(isDtiSubService('一本道')).toBe(true);
    });

    it('非DTI系サービスでfalse', () => {
      expect(isDtiSubService('fanza')).toBe(false);
      expect(isDtiSubService('mgs')).toBe(false);
      expect(isDtiSubService('duga')).toBe(false);
      expect(isDtiSubService('sokmil')).toBe(false);
      expect(isDtiSubService('fc2')).toBe(false);
      expect(isDtiSubService('japanska')).toBe(false);
    });
  });

  describe('getAspBadgeColor', () => {
    it('fanzaのバッジカラーを取得', () => {
      const color = getAspBadgeColor('fanza');
      expect(color.bg).toBe('bg-pink-600');
      expect(color.text).toBe('text-white');
    });

    it('mgsのバッジカラーを取得', () => {
      const color = getAspBadgeColor('mgs');
      expect(color.bg).toBe('bg-blue-600');
    });

    it('caribbeancomのバッジカラーを取得', () => {
      const color = getAspBadgeColor('caribbeancom');
      expect(color.bg).toBe('bg-teal-600');
    });

    it('大文字ASP名でも取得可能', () => {
      const color = getAspBadgeColor('FANZA');
      expect(color.bg).toBe('bg-pink-600');
    });

    it('未知のASPはデフォルトカラー', () => {
      const color = getAspBadgeColor('unknown');
      expect(color.bg).toBe('bg-gray-600');
    });
  });

  describe('定数のエクスポート', () => {
    it('DTI_URL_PATTERNSが正しく定義されている', () => {
      expect(DTI_URL_PATTERNS['caribbeancom.com']).toBe('caribbeancom');
      expect(DTI_URL_PATTERNS['1pondo.tv']).toBe('1pondo');
      expect(Object.keys(DTI_URL_PATTERNS).length).toBeGreaterThan(10);
    });

    it('JA_TO_EN_MAPが正しく定義されている', () => {
      expect(JA_TO_EN_MAP['カリビアンコム']).toBe('caribbeancom');
      expect(JA_TO_EN_MAP['一本道']).toBe('1pondo');
    });

    it('UPPER_TO_LOWER_MAPが正しく定義されている', () => {
      expect(UPPER_TO_LOWER_MAP['FANZA']).toBe('fanza');
      expect(UPPER_TO_LOWER_MAP['MGS']).toBe('mgs');
    });

    it('ASP_DISPLAY_NAMESが正しく定義されている', () => {
      expect(ASP_DISPLAY_NAMES['fanza']).toBe('FANZA');
      expect(ASP_DISPLAY_NAMES['mgs']).toBe('MGS動画');
    });

    it('VALID_ASP_NAMESが正しく定義されている', () => {
      expect(VALID_ASP_NAMES.has('fanza')).toBe(true);
      expect(VALID_ASP_NAMES.has('mgs')).toBe(true);
      expect(VALID_ASP_NAMES.has('invalid')).toBe(false);
    });
  });

  describe('SQL生成ヘルパー', () => {
    describe('buildDtiUrlCaseParts', () => {
      it('DTI URL判定のCASE文を生成', () => {
        const sql = buildDtiUrlCaseParts('ps.url');
        expect(sql).toContain("WHEN ps.url LIKE '%caribbeancom.com%' THEN 'caribbeancom'");
        expect(sql).toContain("WHEN ps.url LIKE '%1pondo.tv%' THEN '1pondo'");
      });
    });

    describe('buildJaToEnCaseParts', () => {
      it('日本語→英語変換のCASE文を生成', () => {
        const sql = buildJaToEnCaseParts('ps.asp_name');
        expect(sql).toContain("WHEN ps.asp_name = 'カリビアンコム' THEN 'caribbeancom'");
        expect(sql).toContain("WHEN ps.asp_name = '一本道' THEN '1pondo'");
      });
    });

    describe('buildUpperToLowerCaseParts', () => {
      it('大文字→小文字変換のCASE文を生成', () => {
        const sql = buildUpperToLowerCaseParts('ps.asp_name');
        expect(sql).toContain("WHEN ps.asp_name = 'FANZA' THEN 'fanza'");
        expect(sql).toContain("WHEN ps.asp_name = 'MGS' THEN 'mgs'");
      });
    });

    describe('buildAspNormalizationSql', () => {
      it('完全な正規化CASE式を生成', () => {
        const sql = buildAspNormalizationSql('ps.asp_name', 'ps.url');
        expect(sql).toContain('CASE');
        expect(sql).toContain("WHEN ps.asp_name = 'DTI' THEN");
        expect(sql).toContain('ELSE LOWER(ps.asp_name)');
      });
    });

    describe('buildAspMatchSql', () => {
      it('IN句付きCASE式を生成', () => {
        const sql = buildAspMatchSql('ps.asp_name', 'ps.url', ['fanza', 'mgs']);
        expect(sql).toContain("IN ('fanza', 'mgs')");
      });

      it('空のリストでも動作', () => {
        const sql = buildAspMatchSql('ps.asp_name', 'ps.url', []);
        expect(sql).toContain('IN ()');
      });
    });
  });

  describe('エッジケース', () => {
    it('空文字列の正規化', () => {
      expect(normalizeAspName('')).toBe('');
    });

    it('スペースを含むASP名', () => {
      expect(normalizeAspName('Tokyo Hot')).toBe('tokyohot');
    });

    it('数字で始まるASP名', () => {
      expect(normalizeAspName('1PONDO')).toBe('1pondo');
      expect(normalizeAspName('10MUSUME')).toBe('10musume');
    });

    it('特殊なDTIサブサービス', () => {
      expect(normalizeAspName('DTI', 'https://x1x.com/sample')).toBe('x1x');
      expect(normalizeAspName('DTI', 'https://av9898.com/sample')).toBe('av9898');
    });
  });
});
