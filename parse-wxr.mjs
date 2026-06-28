/**
 * parse-wxr.mjs
 * WordPress WXR XML を解析して posts-list.json を生成する
 * 実行: node parse-wxr.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { parseStringPromise } from 'xml2js';

// --- CONFIG ---
const WXR_PATH = process.argv[2] || '../wordpress-export/export.xml'; // コマンドライン引数で上書き可
const OUTPUT_PATH = './posts-list.json';
// --------------

const xml = readFileSync(WXR_PATH, 'utf-8');
const data = await parseStringPromise(xml, { explicitArray: true });

const channel = data.rss.channel[0];
const items = channel.item || [];

// attachment アイテムから画像URLマップを構築（post_id → url）
const attachments = {};
for (const item of items) {
  if (item['wp:post_type']?.[0] === 'attachment') {
    const id = item['wp:post_id']?.[0];
    const url = item['wp:attachment_url']?.[0];
    const parentId = item['wp:post_parent']?.[0];
    if (id && url) {
      attachments[id] = { url, parentId };
    }
  }
}

// 親記事IDから サムネイルURLを逆引きするマップ
const thumbnailByPostId = {};
for (const id in attachments) {
  const { url, parentId } = attachments[id];
  if (parentId && !thumbnailByPostId[parentId]) {
    thumbnailByPostId[parentId] = url;
  }
}

// 公開済みの投稿を抽出
const posts = items
  .filter(item =>
    item['wp:post_type']?.[0] === 'post' &&
    item['wp:status']?.[0] === 'publish'
  )
  .map(item => {
    const link = item.link?.[0] || '';
    const slug = item['wp:post_name']?.[0] || '';
    const postId = item['wp:post_id']?.[0] || '';

    // アイキャッチ画像を wp:postmeta から取得
    const postMeta = item['wp:postmeta'] || [];
    const thumbnailIdMeta = postMeta.find(
      m => m['wp:meta_key']?.[0] === '_thumbnail_id'
    );
    const thumbnailId = thumbnailIdMeta?.['wp:meta_value']?.[0];
    const featuredImageUrl = thumbnailId
      ? attachments[thumbnailId]?.url || null
      : thumbnailByPostId[postId] || null;

    // タグと カテゴリを分けて取得
    const categories = (item.category || []);
    const tags = categories
      .filter(c => c.$?.domain === 'post_tag')
      .map(c => c._);
    const cats = categories
      .filter(c => c.$?.domain === 'category')
      .map(c => c._);

    const rawDate = item.pubDate?.[0] || item['wp:post_date']?.[0] || '';
    let date = '';
    try {
      date = new Date(rawDate).toISOString().split('T')[0];
    } catch {
      date = rawDate.slice(0, 10);
    }

    return {
      slug,
      title: (item.title?.[0] || '').trim(),
      date,
      tags: [...tags, ...cats],
      description: (item['excerpt:encoded']?.[0] || '').trim(),
      content: item['content:encoded']?.[0] || '',
      originalUrl: link,
      postId,
      featuredImageUrl,
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

// content は重いので一覧用 JSON には含めない
const summary = posts.map(({ content: _c, ...rest }) => rest);
writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2), 'utf-8');

// content つきの全データは別ファイルに保存（convert スクリプトが使用）
writeFileSync('./posts-full.json', JSON.stringify(posts, null, 2), 'utf-8');

console.log(`✅ ${posts.length} 件の公開記事を抽出しました`);
console.log(`📄 posts-list.json  — 一覧確認用（content なし）`);
console.log(`📄 posts-full.json  — 変換スクリプト用（content あり）`);
console.log('');
console.log('次の手順:');
console.log('1. posts-list.json を GSC の CSV と照合し、移行対象を決定する');
console.log('2. target-slugs.json を作成する（例: ["slug-a", "slug-b"]）');
