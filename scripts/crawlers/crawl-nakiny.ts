/**
 * Nakiny.comから出演者名の正規化データをクロールするスクリプト
 * https://nakiny.com/search-actress を対象
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db';
import { performers, performerAliases } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

interface NakinyActress {
  name: string;
  aliases?: string[]; // 別名・旧名
  profileUrl?: string;
}

/**
 * Nakinyの出演者検索ページから情報を取得
 */
async function fetchNakinyActresses(page: number = 1): Promise<NakinyActress[]> {
  const url = `https://nakiny.com/search-actress?page=${page}`;
  console.log(`Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${url}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const actresses: NakinyActress[] = [];

    // 出演者リストを解析（サイト構造に応じて調整が必要）
    $('.actress-item, .performer-item, .model-item').each((_, element) => {
      const name = $(element).find('.name, .actress-name, h3, h4').first().text().trim();
      const profileUrl = $(element).find('a').first().attr('href');

      if (name) {
        actresses.push({
          name,
          profileUrl: profileUrl ? `https://nakiny.com${profileUrl}` : undefined,
        });
      }
    });

    console.log(`  Found ${actresses.length} actresses on page ${page}`);

    // Rate limiting: 2000ms between requests
    await new Promise(resolve => setTimeout(resolve, 2000));

    return actresses;
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error);
    return [];
  }
}

/**
 * 出演者の詳細ページから別名情報を取得
 */
async function fetchActressAliases(profileUrl: string): Promise<string[]> {
  try {
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const aliases: string[] = [];

    // 別名セクションを探す（サイト構造に応じて調整が必要）
    $('.aliases, .aka, .other-names').each((_, element) => {
      const text = $(element).text();
      // カンマ、スラッシュ、セミコロンで分割
      const names = text.split(/[,/;]/).map(n => n.trim()).filter(n => n);
      aliases.push(...names);
    });

    // Rate limiting: 2000ms between requests
    await new Promise(resolve => setTimeout(resolve, 2000));

    return aliases;
  } catch (error) {
    console.error(`Error fetching aliases from ${profileUrl}:`, error);
    return [];
  }
}

/**
 * データベースの出演者名を正規化
 */
async function normalizePerformerNames() {
  const db = getDb();

  console.log('Starting name normalization from Nakiny.com...\n');

  let totalPages = 10; // 最初は10ページまで試す
  let foundActresses = 0;
  let updatedCount = 0;

  for (let page = 1; page <= totalPages; page++) {
    const actresses = await fetchNakinyActresses(page);

    if (actresses.length === 0) {
      console.log(`No more actresses found on page ${page}. Stopping.`);
      break;
    }

    foundActresses += actresses.length;

    for (const actress of actresses) {
      // データベースで類似する名前を検索
      const existingPerformers = await db
        .select()
        .from(performers)
        .where(sql`LOWER(${performers.name}) LIKE LOWER(${'%' + actress.name + '%'})`);

      if (existingPerformers.length > 0) {
        console.log(`  ✓ Found match for "${actress.name}" (${existingPerformers.length} records)`);

        // プロフィールURLから別名を取得してDBに保存
        if (actress.profileUrl) {
          const aliases = await fetchActressAliases(actress.profileUrl);
          if (aliases.length > 0) {
            console.log(`    Aliases: ${aliases.join(', ')}`);
            // 別名をperformer_aliasesテーブルに保存
            for (const alias of aliases) {
              try {
                await db.insert(performerAliases).values({
                  performerId: existingPerformers[0].id,
                  aliasName: alias,
                  source: 'nakiny',
                  isPrimary: false,
                }).onConflictDoNothing();
              } catch (error) {
                // 重複エラーは無視
              }
            }
            console.log(`    ✓ Saved ${aliases.length} alias(es) to DB`);
          }
        }

        updatedCount++;
      }
    }
  }

  console.log('\n========================================');
  console.log('Name Normalization Summary:');
  console.log(`  Found: ${foundActresses} actresses on Nakiny`);
  console.log(`  Matched: ${updatedCount} in database`);
  console.log('========================================');
}

// メイン実行
normalizePerformerNames()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
