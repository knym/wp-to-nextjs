/**
 * generate-redirects.mjs
 * WordPress URL → Next.js URL の 301 リダイレクト設定を生成する
 * 実行: node generate-redirects.mjs
 * 前提: posts-list.json, target-slugs.json が存在すること
 */

import { readFileSync, writeFileSync } from 'fs';

const POSTS = JSON.parse(readFileSync('./posts-list.json', 'utf-8'));
const TARGET_SLUGS = new Set(
  JSON.parse(readFileSync('./target-slugs.json', 'utf-8'))
);

const redirects = [];

for (const post of POSTS) {
  if (!post.originalUrl) continue;

  let wpPath;
  try {
    const url = new URL(post.originalUrl);
    wpPath = url.pathname.replace(/\/$/, ''); // 末尾スラッシュ除去
  } catch {
    continue;
  }

  if (!wpPath || wpPath === '/') continue;

  // 移行済み記事 → /blog/slug、未移行記事 → トップ
  const destination = TARGET_SLUGS.has(post.slug)
    ? `/blog/${post.slug}`
    : '/';

  // 末尾スラッシュあり/なし両方を登録
  redirects.push({ source: wpPath, destination, permanent: true });
  if (!wpPath.endsWith('/')) {
    redirects.push({ source: `${wpPath}/`, destination, permanent: true });
  }
}

// WordPress 共通パスもトップにリダイレクト
const commonWpPaths = [
  '/wp-admin',
  '/wp-login.php',
  '/feed',
  '/feed/',
  '/comments/feed',
  '/category/:slug*',
  '/tag/:slug*',
  '/author/:slug*',
  '/page/:num',
];

for (const source of commonWpPaths) {
  redirects.push({ source, destination: '/', permanent: true });
}

writeFileSync('./redirects-output.json', JSON.stringify(redirects, null, 2), 'utf-8');

console.log(`✅ ${redirects.length} 件のリダイレクトを生成しました → redirects-output.json`);
console.log('');

// next.config.ts 用のコードスニペットを表示
console.log('next.config.ts に以下を追加してください:');
console.log('');
console.log('  import redirectsData from \'../scripts/redirects-output.json\' assert { type: \'json\' };');
console.log('');
console.log('  async redirects() {');
console.log('    return redirectsData;');
console.log('  },');
