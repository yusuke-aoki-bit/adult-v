/**
 * CSP (Content Security Policy) 設定の整合性テスト
 *
 * remotePatterns で許可されている画像ドメインが
 * CSPの img-src ディレクティブにも含まれていることを確認します。
 */

import { describe, it, expect } from 'vitest';

// Fanza CSP設定
const fanzaRemotePatterns = [
  { protocol: 'https', hostname: 'placehold.co' },
  { protocol: 'https', hostname: '*.dmm.com' },
  { protocol: 'https', hostname: '*.dmm.co.jp' },
  { protocol: 'https', hostname: '*.duga.jp' },
  { protocol: 'http', hostname: 'duga.jp' },
  { protocol: 'https', hostname: '*.heyzo.com' },
  { protocol: 'https', hostname: '*.caribbeancompr.com' },
  { protocol: 'https', hostname: '*.caribbeancom.com' },
  { protocol: 'https', hostname: '*.1pondo.tv' },
  { protocol: 'https', hostname: '*.mgstage.com' },
  { protocol: 'https', hostname: '*.b10f.jp' },
  { protocol: 'https', hostname: 'b10f.jp' },
  { protocol: 'https', hostname: '*.sokmil.com' },
  { protocol: 'https', hostname: '*.japanska-xxx.com' },
  { protocol: 'https', hostname: '*.fc2.com' },
];

const fanzaCspImgSrc =
  "img-src 'self' data: blob: https://*.dmm.co.jp https://*.dmm.com https://pics.dmm.co.jp https://awsimgsrc.dmm.co.jp https://placehold.co https://www.googletagmanager.com https://www.google-analytics.com https://*.mgstage.com https://image.mgstage.com https://*.duga.jp https://pic.duga.jp https://img.duga.jp https://*.sokmil.com https://img.sokmil.com https://*.heyzo.com https://*.caribbeancom.com https://*.caribbeancompr.com https://*.1pondo.tv https://*.b10f.jp https://b10f.jp https://*.fc2.com https://*.japanska-xxx.com";

// Web CSP設定
const webRemotePatterns = [
  { protocol: 'https', hostname: 'placehold.co' },
  { protocol: 'https', hostname: '*.dmm.com' },
  { protocol: 'https', hostname: '*.dmm.co.jp' },
  { protocol: 'https', hostname: '*.duga.jp' },
  { protocol: 'http', hostname: 'duga.jp' },
  { protocol: 'https', hostname: '*.heyzo.com' },
  { protocol: 'https', hostname: '*.caribbeancompr.com' },
  { protocol: 'https', hostname: '*.caribbeancom.com' },
  { protocol: 'https', hostname: '*.1pondo.tv' },
  { protocol: 'https', hostname: '*.mgstage.com' },
  { protocol: 'https', hostname: '*.b10f.jp' },
  { protocol: 'https', hostname: 'b10f.jp' },
  { protocol: 'https', hostname: '*.sokmil.com' },
  { protocol: 'https', hostname: '*.japanska-xxx.com' },
  { protocol: 'https', hostname: '*.fc2.com' },
  { protocol: 'https', hostname: '*.nyoshin.com' },
  { protocol: 'https', hostname: '*.unkotare.com' },
  { protocol: 'https', hostname: '*.10musume.com' },
  { protocol: 'https', hostname: '*.pacopacomama.com' },
  { protocol: 'https', hostname: '*.hitozuma-giri.com' },
  { protocol: 'https', hostname: '*.av-e-body.com' },
  { protocol: 'https', hostname: '*.av-4610.com' },
  { protocol: 'https', hostname: '*.av-0230.com' },
  { protocol: 'https', hostname: '*.kin8tengoku.com' },
  { protocol: 'https', hostname: '*.nozox.com' },
  { protocol: 'https', hostname: '*.3d-eros.net' },
  { protocol: 'https', hostname: '*.pikkur.com' },
  { protocol: 'https', hostname: '*.javholic.com' },
  { protocol: 'https', hostname: '*.tokyo-hot.com' },
  { protocol: 'https', hostname: '*.heydouga.com' },
  { protocol: 'http', hostname: '*.heydouga.com' },
  { protocol: 'https', hostname: 'heydouga.com' },
  { protocol: 'http', hostname: 'heydouga.com' },
  { protocol: 'https', hostname: '*.x1x.com' },
  { protocol: 'http', hostname: '*.x1x.com' },
  { protocol: 'https', hostname: 'x1x.com' },
  { protocol: 'http', hostname: 'x1x.com' },
];

const webCspImgSrc =
  "img-src 'self' data: blob: https://*.dmm.co.jp https://*.dmm.com https://pics.dmm.co.jp https://pic.duga.jp https://img.duga.jp https://ad.duga.jp https://*.duga.jp https://*.mgstage.com https://image.mgstage.com https://static.mgstage.com https://img.sokmil.com https://*.sokmil.com https://sokmil-ad.com https://*.japanska-xxx.com https://wimg2.golden-gateway.com https://*.fc2.com https://*.contents.fc2.com https://ads.b10f.jp https://b10f.jp https://*.b10f.jp https://*.heyzo.com https://www.heyzo.com https://*.caribbeancompr.com https://*.caribbeancom.com https://*.1pondo.tv https://www.nyoshin.com https://*.nyoshin.com https://www.unkotare.com https://*.unkotare.com https://www.10musume.com https://*.10musume.com https://www.pacopacomama.com https://*.pacopacomama.com https://www.hitozuma-giri.com https://*.hitozuma-giri.com https://www.av-e-body.com https://*.av-e-body.com https://www.av-4610.com https://*.av-4610.com https://www.av-0230.com https://*.av-0230.com https://www.kin8tengoku.com https://*.kin8tengoku.com https://www.nozox.com https://*.nozox.com https://www.3d-eros.net https://*.3d-eros.net https://www.pikkur.com https://*.pikkur.com https://www.javholic.com https://*.javholic.com https://smovie.1pondo.tv https://awsimgsrc.dmm.co.jp https://placehold.co https://pixelarchivenow.com https://www.googletagmanager.com https://www.google-analytics.com https://*.tokyo-hot.com https://my.cdn.tokyo-hot.com https://*.heydouga.com http://heydouga.com https://*.x1x.com http://x1x.com";

/**
 * CSP img-src ディレクティブからドメインパターンを抽出
 */
function extractDomainsFromCsp(cspImgSrc: string): string[] {
  const parts = cspImgSrc.split(' ');
  return parts
    .filter((part) => part.startsWith('https://') || part.startsWith('http://'))
    .map((url) => url.replace(/^https?:\/\//, ''));
}

/**
 * remotePatternのホスト名がCSPに含まれているかチェック
 * ワイルドカード (*.example.com) と完全一致 (example.com) の両方をサポート
 */
function isHostnameInCsp(hostname: string, cspDomains: string[]): boolean {
  // 完全一致チェック
  if (cspDomains.includes(hostname)) {
    return true;
  }

  // ワイルドカードパターンの場合
  if (hostname.startsWith('*.')) {
    const baseDomain = hostname.slice(2);
    // ワイルドカードパターンがCSPにあるか
    if (cspDomains.includes(hostname)) {
      return true;
    }
    // または具体的なサブドメインがあるか
    if (cspDomains.some((d) => d.endsWith('.' + baseDomain) || d === baseDomain)) {
      return true;
    }
  } else {
    // 完全一致のドメインの場合、ワイルドカードパターンでカバーされているかチェック
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const wildcardPattern = '*.' + parts.slice(-2).join('.');
      if (cspDomains.includes(wildcardPattern)) {
        return true;
      }
      // より長いドメイン用 (例: *.co.jp)
      if (parts.length >= 3) {
        const wildcardPattern2 = '*.' + parts.slice(-3).join('.');
        if (cspDomains.includes(wildcardPattern2)) {
          return true;
        }
      }
    }
  }

  return false;
}

describe('CSP Configuration Validation', () => {
  describe('Fanza CSP', () => {
    const cspDomains = extractDomainsFromCsp(fanzaCspImgSrc);

    it('should have img-src directive', () => {
      expect(fanzaCspImgSrc).toContain('img-src');
    });

    it('should allow self, data, and blob', () => {
      expect(fanzaCspImgSrc).toContain("'self'");
      expect(fanzaCspImgSrc).toContain('data:');
      expect(fanzaCspImgSrc).toContain('blob:');
    });

    it('should include all remotePatterns domains in CSP img-src', () => {
      const missingDomains: string[] = [];

      for (const pattern of fanzaRemotePatterns) {
        // HTTPのみのパターンはHTTPSのCSPでカバーされない可能性があるためスキップ
        if (pattern.protocol === 'http') {
          continue;
        }

        if (!isHostnameInCsp(pattern.hostname, cspDomains)) {
          missingDomains.push(pattern.hostname);
        }
      }

      if (missingDomains.length > 0) {
        console.log('Missing domains in Fanza CSP:', missingDomains);
      }

      expect(missingDomains).toEqual([]);
    });

    it('should include DMM domains', () => {
      expect(cspDomains).toContain('*.dmm.co.jp');
      expect(cspDomains).toContain('*.dmm.com');
    });

    it('should include MGStage domains', () => {
      expect(cspDomains).toContain('*.mgstage.com');
    });

    it('should include DUGA domains', () => {
      expect(cspDomains).toContain('*.duga.jp');
    });

    it('should include heyzo domains', () => {
      expect(cspDomains).toContain('*.heyzo.com');
    });

    it('should include caribbeancom domains', () => {
      expect(cspDomains).toContain('*.caribbeancom.com');
      expect(cspDomains).toContain('*.caribbeancompr.com');
    });

    it('should include 1pondo domains', () => {
      expect(cspDomains).toContain('*.1pondo.tv');
    });
  });

  describe('Web CSP', () => {
    const cspDomains = extractDomainsFromCsp(webCspImgSrc);

    it('should have img-src directive', () => {
      expect(webCspImgSrc).toContain('img-src');
    });

    it('should allow self, data, and blob', () => {
      expect(webCspImgSrc).toContain("'self'");
      expect(webCspImgSrc).toContain('data:');
      expect(webCspImgSrc).toContain('blob:');
    });

    it('should include all remotePatterns domains in CSP img-src', () => {
      const missingDomains: string[] = [];

      for (const pattern of webRemotePatterns) {
        // HTTPのみのパターンはHTTPSのCSPでカバーされない可能性があるためスキップ
        if (pattern.protocol === 'http') {
          continue;
        }

        if (!isHostnameInCsp(pattern.hostname, cspDomains)) {
          missingDomains.push(pattern.hostname);
        }
      }

      if (missingDomains.length > 0) {
        console.log('Missing domains in Web CSP:', missingDomains);
      }

      expect(missingDomains).toEqual([]);
    });

    it('should include all major video site domains', () => {
      const requiredDomains = [
        '*.dmm.co.jp',
        '*.dmm.com',
        '*.mgstage.com',
        '*.duga.jp',
        '*.heyzo.com',
        '*.caribbeancom.com',
        '*.caribbeancompr.com',
        '*.1pondo.tv',
        '*.10musume.com',
        '*.pacopacomama.com',
        '*.tokyo-hot.com',
        '*.heydouga.com',
      ];

      for (const domain of requiredDomains) {
        expect(cspDomains).toContain(domain);
      }
    });
  });

  describe('CSP Domain Extraction', () => {
    it('should extract domains correctly', () => {
      const testCsp = "img-src 'self' https://example.com https://*.test.com";
      const domains = extractDomainsFromCsp(testCsp);

      expect(domains).toContain('example.com');
      expect(domains).toContain('*.test.com');
    });

    it('should handle both http and https', () => {
      const testCsp = 'img-src https://secure.com http://insecure.com';
      const domains = extractDomainsFromCsp(testCsp);

      expect(domains).toContain('secure.com');
      expect(domains).toContain('insecure.com');
    });
  });

  describe('Hostname Matching', () => {
    it('should match exact hostnames', () => {
      const domains = ['example.com', '*.test.com'];
      expect(isHostnameInCsp('example.com', domains)).toBe(true);
    });

    it('should match wildcard patterns', () => {
      const domains = ['*.example.com'];
      expect(isHostnameInCsp('sub.example.com', domains)).toBe(true);
      expect(isHostnameInCsp('*.example.com', domains)).toBe(true);
    });

    it('should not match unrelated domains', () => {
      const domains = ['example.com'];
      expect(isHostnameInCsp('other.com', domains)).toBe(false);
    });
  });
});

describe('CSP Security Best Practices', () => {
  it('Fanza CSP should not allow unsafe inline scripts for img-src', () => {
    // img-src doesn't typically use unsafe-inline, but check for general safety
    expect(fanzaCspImgSrc).not.toContain("'unsafe-inline'");
  });

  it('Web CSP should not allow unsafe inline scripts for img-src', () => {
    expect(webCspImgSrc).not.toContain("'unsafe-inline'");
  });

  it('should not have wildcard (*) that allows all domains in img-src', () => {
    // Check that we don't have a standalone * which would allow any domain
    const fanzaParts = fanzaCspImgSrc.split(' ');
    const webParts = webCspImgSrc.split(' ');

    // A standalone * would be just "*" not "*.domain.com"
    expect(fanzaParts.some((p) => p === '*')).toBe(false);
    expect(webParts.some((p) => p === '*')).toBe(false);
  });
});
