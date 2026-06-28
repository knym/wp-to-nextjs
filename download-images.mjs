/**
 * download-images.mjs
 * 移行対象記事の WordPress 画像を public/img/ にダウンロードする
 * 実行: node download-images.mjs
 * 前提: target-slugs.json, posts-full.json が存在すること
 */

import fetch from 'node-fetch';
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs';
import { readFileSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';

// --- CONFIG ---
const SITE_URL = process.env.SITE_URL || 'https://example.com'; // 自分の WordPress サイト URL に変更
const IMG_DIR = process.env.IMG_DIR || '../your-nextjs-app/public/img/'; // Next.js の public/img/ パスに変更
// --------------

const TARGET_SLUGS = JSON.parse(readFileSync('./target-slugs.json', 'utf-8'));
const POSTS = JSON.parse(readFileSync('./posts-full.json', 'utf-8'));
const IMAGE_MAP_PATH = './image-map.json';

mkdirSync(IMG_DIR, { recursive: true });

// HTML から wp-content/uploads URL を抽出
function extractImageUrls(html) {
  const escaped = SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}/wp-content/uploads/[^"'\\s>)]+`, 'g');
  return [...new Set(html.match(regex) || [])];
}

// WordPress 画像 URL → ローカルファイル名に変換
function urlToLocalName(imageUrl) {
  try {
    const url = new URL(imageUrl);
    // /wp-content/uploads/YYYY/MM/filename.jpg → YYYY-MM-filename.jpg
    const parts = url.pathname
      .replace('/wp-content/uploads/', '')
      .split('/');
    return parts.join('-');
  } catch {
    return path.basename(imageUrl);
  }
}

async function downloadImage(url, destPath) {
  if (existsSync(destPath)) {
    console.log(`  ⏭  スキップ（既存）: ${path.basename(destPath)}`);
    return true;
  }
  try {
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) {
      console.warn(`  ⚠  取得失敗 (${res.status}): ${url}`);
      return false;
    }
    await pipeline(res.body, createWriteStream(destPath));
    console.log(`  ✅ ダウンロード: ${path.basename(destPath)}`);
    return true;
  } catch (err) {
    console.warn(`  ❌ エラー: ${url} — ${err.message}`);
    return false;
  }
}

// 移行対象記事の画像を収集
const targetPosts = POSTS.filter(p => TARGET_SLUGS.includes(p.slug));
const imageMap = {};  // WordPressURL → /img/ローカルパス

for (const post of targetPosts) {
  console.log(`\n[${post.slug}]`);

  // アイキャッチ画像
  if (post.featuredImageUrl) {
    const localName = urlToLocalName(post.featuredImageUrl);
    const destPath = path.join(IMG_DIR, localName);
    const ok = await downloadImage(post.featuredImageUrl, destPath);
    if (ok) imageMap[post.featuredImageUrl] = `/img/${localName}`;
  }

  // 本文内画像
  const urls = extractImageUrls(post.content);
  for (const url of urls) {
    const localName = urlToLocalName(url);
    const destPath = path.join(IMG_DIR, localName);
    const ok = await downloadImage(url, destPath);
    if (ok) imageMap[url] = `/img/${localName}`;
  }
}

writeFileSync(IMAGE_MAP_PATH, JSON.stringify(imageMap, null, 2), 'utf-8');
console.log(`\n✅ image-map.json を生成しました（${Object.keys(imageMap).length} 件）`);
