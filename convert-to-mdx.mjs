/**
 * convert-to-mdx.mjs
 * WordPress HTML コンテンツを MDX に変換して content/posts/ に書き出す
 * 実行: node convert-to-mdx.mjs
 * 前提: target-slugs.json, posts-full.json, image-map.json が存在すること
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// --- CONFIG ---
const MDX_DIR = process.env.MDX_DIR || '../your-nextjs-app/content/posts/'; // Next.js の content/posts/ パスに変更
// --------------

const TARGET_SLUGS = JSON.parse(readFileSync('./target-slugs.json', 'utf-8'));
const POSTS = JSON.parse(readFileSync('./posts-full.json', 'utf-8'));
const IMAGE_MAP = JSON.parse(readFileSync('./image-map.json', 'utf-8'));

mkdirSync(MDX_DIR, { recursive: true });

// Turndown セットアップ
const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  fence: '```',
  hr: '---',
});
td.use(gfm);

// WordPress ブロックコメントを除去
td.addRule('remove-wp-block-comments', {
  filter: node =>
    node.nodeType === 8 && // Comment node
    (node.nodeValue || '').trim().startsWith('wp:'),
  replacement: () => '',
});

// Gutenberg wp: コメントが残った場合も除去（テキストノードとして現れる場合）
td.addRule('remove-figure-wrapper', {
  filter: 'figure',
  replacement: content => content.trim() + '\n\n',
});

// pre > code ブロックの言語クラスを保持
td.addRule('code-block', {
  filter: node =>
    node.nodeName === 'PRE' &&
    node.firstChild?.nodeName === 'CODE',
  replacement: (_, node) => {
    const code = node.firstChild;
    const classAttr = code?.getAttribute('class') || '';
    const lang = classAttr.match(/language-(\S+)/)?.[1] || '';
    const text = code?.textContent || '';
    return `\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n`;
  },
});

// 画像 src を WordPress URL → ローカルパスに差し替え
td.addRule('local-image', {
  filter: 'img',
  replacement: (_, node) => {
    const src = node.getAttribute('src') || '';
    // data: URL はそのまま（稀なケース）
    if (src.startsWith('data:')) return '';
    const localSrc = IMAGE_MAP[src] || src;
    const alt = node.getAttribute('alt') || '';
    return `![${alt}](${localSrc})`;
  },
});

// WordPress の [shortcode] を除去
function removeShortcodes(html) {
  return html
    // キャプション付き画像
    .replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/g, '$1')
    // その他のショートコード
    .replace(/\[[a-z_-]+[^\]]*\/?\]/g, '')
    .replace(/\[[a-z_-]+[^\]]*\][\s\S]*?\[\/[a-z_-]+\]/g, '');
}

// Gutenberg の <!-- wp:xxx --> コメントを除去
function removeGutenbergComments(html) {
  return html
    .replace(/<!--\s*wp:[^>]*-->/g, '')
    .replace(/<!--\s*\/wp:[^>]*-->/g, '');
}

function buildFrontmatter({ title, date, tags, description, image }) {
  const lines = ['---'];
  lines.push(`title: ${JSON.stringify(title)}`);
  lines.push(`date: "${date}"`);
  lines.push(`tags: ${JSON.stringify(tags.length ? tags : ['未分類'])}`);
  if (description) {
    const desc = description.replace(/<[^>]+>/g, '').trim().slice(0, 200);
    if (desc) lines.push(`description: ${JSON.stringify(desc)}`);
  }
  if (image) lines.push(`image: "${image}"`);
  lines.push('---');
  return lines.join('\n');
}

// 変換実行
const targetPosts = POSTS.filter(p => TARGET_SLUGS.includes(p.slug));
let successCount = 0;

for (const post of targetPosts) {
  console.log(`\n[${post.slug}] 変換中...`);

  let html = post.content;
  html = removeShortcodes(html);
  html = removeGutenbergComments(html);

  const markdown = td.turndown(html);
  const featuredImage = post.featuredImageUrl
    ? IMAGE_MAP[post.featuredImageUrl] || null
    : null;

  const fm = buildFrontmatter({
    title: post.title,
    date: post.date,
    tags: post.tags,
    description: post.description,
    image: featuredImage,
  });

  const mdxContent = `${fm}\n\n${markdown.trim()}\n`;
  const outputPath = `${MDX_DIR}${post.slug}.mdx`;
  writeFileSync(outputPath, mdxContent, 'utf-8');

  console.log(`  ✅ 書き出し: ${outputPath}`);
  successCount++;
}

console.log(`\n✅ ${successCount} 件の MDX ファイルを生成しました`);
console.log('');
console.log('次の手順:');
console.log('1. 各 MDX ファイルを目視確認・手動修正する');
console.log('   - ショートコード残留がないか');
console.log('   - コードブロックの言語指定が適切か');
console.log('   - 画像が正しく表示されるか（ローカルで確認）');
console.log('2. node generate-redirects.mjs を実行する');
