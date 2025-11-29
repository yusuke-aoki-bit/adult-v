/**
 * FC2ページ構造デバッグスクリプト
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function main() {
  console.log('FC2ページ構造デバッグ開始...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8' });

  // === video.fc2.com/a/ を調査 ===
  console.log('=== video.fc2.com/a/ ===\n');

  // 年齢確認クッキー設定
  await page.setCookie({
    name: 'age_check',
    value: '1',
    domain: 'video.fc2.com',
  });

  await page.goto('https://video.fc2.com/a/?_tct=&d=2', { waitUntil: 'networkidle2', timeout: 60000 });

  // 追加で待機（JSレンダリング待ち）
  await new Promise(r => setTimeout(r, 5000));

  const videoPageHtml = await page.content();
  fs.writeFileSync('fc2-video-page.html', videoPageHtml, 'utf-8');
  console.log('HTML保存: fc2-video-page.html');

  // リンクを抽出
  const videoLinks = await page.evaluate(() => {
    const links: { href: string; text: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent?.trim().substring(0, 50) || '';
      if (href.includes('content') || href.includes('video') || /\d{6,}/.test(href)) {
        links.push({ href, text });
      }
    });
    return links.slice(0, 30);
  });

  console.log('\nvideo.fc2.com リンク:');
  videoLinks.forEach(link => {
    console.log(`  ${link.href.substring(0, 80)} | ${link.text.substring(0, 30)}`);
  });

  // data属性を調査
  const videoDataAttrs = await page.evaluate(() => {
    const attrs: string[] = [];
    document.querySelectorAll('[data-id], [data-content-id], [data-video-id]').forEach(el => {
      const dataId = el.getAttribute('data-id');
      const contentId = el.getAttribute('data-content-id');
      const videoId = el.getAttribute('data-video-id');
      attrs.push(`data-id=${dataId}, data-content-id=${contentId}, data-video-id=${videoId}`);
    });
    return attrs.slice(0, 20);
  });

  console.log('\nvideo.fc2.com data属性:');
  videoDataAttrs.forEach(attr => console.log(`  ${attr}`));

  // 実際の動画アイテムを探す
  const videoItems = await page.evaluate(() => {
    const items: string[] = [];
    // さまざまなセレクタを試す
    const selectors = [
      '.c-video_item',
      '.video_item',
      '.video-item',
      '.item',
      'article',
      '[class*="video"]',
      '[class*="content"]',
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) {
        items.push(`${sel}: ${elements.length}件`);
        // 最初の要素のHTMLを一部取得
        const firstEl = elements[0];
        if (firstEl) {
          items.push(`  最初の要素: ${firstEl.outerHTML.substring(0, 300)}`);
        }
      }
    }
    return items;
  });

  console.log('\nvideo.fc2.com 要素調査:');
  videoItems.forEach(item => console.log(item));

  // === adult.contents.fc2.com を調査 ===
  console.log('\n\n=== adult.contents.fc2.com ===\n');

  await page.setCookie({
    name: 'contents_adult',
    value: '1',
    domain: 'adult.contents.fc2.com',
  });

  await page.goto('https://adult.contents.fc2.com/', { waitUntil: 'networkidle2', timeout: 60000 });

  // 追加で待機
  await new Promise(r => setTimeout(r, 5000));

  const contentsPageHtml = await page.content();
  fs.writeFileSync('fc2-contents-page.html', contentsPageHtml, 'utf-8');
  console.log('HTML保存: fc2-contents-page.html');

  // リンクを抽出
  const contentsLinks = await page.evaluate(() => {
    const links: { href: string; text: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent?.trim().substring(0, 50) || '';
      if (href.includes('article') || href.includes('detail') || /\d{6,}/.test(href)) {
        links.push({ href, text });
      }
    });
    return links.slice(0, 30);
  });

  console.log('\nadult.contents.fc2.com リンク:');
  contentsLinks.forEach(link => {
    console.log(`  ${link.href.substring(0, 80)} | ${link.text.substring(0, 30)}`);
  });

  // data属性を調査
  const contentsDataAttrs = await page.evaluate(() => {
    const attrs: string[] = [];
    document.querySelectorAll('[data-id], [data-article-id]').forEach(el => {
      const dataId = el.getAttribute('data-id');
      const articleId = el.getAttribute('data-article-id');
      attrs.push(`data-id=${dataId}, data-article-id=${articleId}`);
    });
    return attrs.slice(0, 20);
  });

  console.log('\nadult.contents.fc2.com data属性:');
  contentsDataAttrs.forEach(attr => console.log(`  ${attr}`));

  // c-cntCard要素を調査
  const cardItems = await page.evaluate(() => {
    const items: string[] = [];
    const cards = document.querySelectorAll('.c-cntCard, .item, article, [class*="card"]');
    items.push(`カード系要素: ${cards.length}件`);

    if (cards.length > 0) {
      const firstCard = cards[0];
      items.push(`最初のカード:\n${firstCard.outerHTML.substring(0, 500)}`);

      // カード内のリンクを探す
      const cardLinks = firstCard.querySelectorAll('a');
      cardLinks.forEach(a => {
        items.push(`  リンク: ${a.getAttribute('href')}`);
      });
    }
    return items;
  });

  console.log('\nadult.contents.fc2.com カード要素:');
  cardItems.forEach(item => console.log(item));

  await browser.close();
  console.log('\n完了');
}

main().catch(console.error);
