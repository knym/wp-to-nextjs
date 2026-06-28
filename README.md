# wp-to-nextjs

WordPress (WXR エクスポート) を Next.js + MDX に移行するスクリプト一式。

記事変換・画像取得・リダイレクト生成の4ステップを自動化します。

## できること

| スクリプト | 役割 |
|---|---|
| `parse-wxr.mjs` | WXR XML を解析して記事リストを生成 |
| `download-images.mjs` | WordPress の画像を `public/img/` にダウンロード |
| `convert-to-mdx.mjs` | WordPress HTML → MDX に変換 |
| `generate-redirects.mjs` | 旧 URL → 新 URL の 301 リダイレクト設定を生成 |

## 前提

- Node.js 18+
- WordPress の WXR エクスポートファイル（XML）
- Google Search Console の検索パフォーマンス CSV（移行対象の優先度判断に使用）

## ディレクトリ構成

```
your-project/
├── wp-to-nextjs/          ← このリポジトリ
├── data-WP/               ← WXR ファイルを置く（git 管理外・公開禁止）
│   └── export.xml
├── data-GSC/              ← GSC データを置く（git 管理外・公開禁止）
│   └── pages.csv
└── your-nextjs-app/       ← 移行先の Next.js プロジェクト
    ├── content/posts/
    └── public/img/
```

> `data-WP/` と `data-GSC/` は個人情報・アクセスデータを含みます。絶対に git 管理しないでください。

### WXR ファイルの取得

WordPress 管理画面 → ツール → エクスポート → 投稿 → 「エクスポートファイルをダウンロード」  
→ `data-WP/export.xml` として保存

### GSC CSV の取得

Search Console → 検索パフォーマンス → ページ → クリック数で降順ソート → エクスポート → CSV  
→ `data-GSC/pages.csv` として保存

## セットアップ

```bash
git clone https://github.com/knym/wp-to-nextjs.git
cd wp-to-nextjs
npm install
```

## 設定

各スクリプトの上部に `CONFIG` セクションがあります。環境変数で上書きできます。

| 変数 | デフォルト | 説明 |
|---|---|---|
| `SITE_URL` | `https://example.com` | WordPress サイトの URL |
| `IMG_DIR` | `../your-nextjs-app/public/img/` | 画像の保存先 |
| `MDX_DIR` | `../your-nextjs-app/content/posts/` | MDX の出力先 |

```bash
# 例
SITE_URL=https://yoursite.com IMG_DIR=../myapp/public/img/ node download-images.mjs
```

## 実行手順

### Step 1: WXR を解析して記事リストを生成

```bash
node parse-wxr.mjs ../data-WP/export.xml
```

`posts-list.json`（タイトル・スラッグ・日付の一覧）と `posts-full.json`（本文入り・変換用）を生成します。

### Step 2: 移行対象を決めて target-slugs.json を作成

`posts-list.json` を `data-GSC/pages.csv` と照らし合わせ、クリック数の多い記事を移行対象に選びます。

```json
["post-slug-a", "post-slug-b", "post-slug-c"]
```

→ `target-slugs.json` として保存

### Step 3: 画像をダウンロード

```bash
SITE_URL=https://yoursite.com node download-images.mjs
```

`public/img/` に画像を保存し、`image-map.json`（WordPress URL → ローカルパスの対応表）を生成します。

### Step 4: MDX に変換

```bash
node convert-to-mdx.mjs
```

`target-slugs.json` に含まれる記事を MDX に変換して `content/posts/` に書き出します。

変換後は各ファイルを目視確認してください：

- `[caption]` `[gallery]` 等のショートコードが残っていないか
- コードブロックの言語指定（` ```bash ` など）が正しいか
- 画像パスが `/img/xxx` になっているか

### Step 5: リダイレクト設定を生成

```bash
node generate-redirects.mjs
```

`redirects-output.json` を生成します。Next.js の `next.config.ts` に追加してください：

```typescript
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const redirectsData = require("./redirects.json");

const nextConfig = {
  async redirects() {
    return redirectsData;
  },
};
```

### Step 6: ビルド確認

```bash
cd ../your-nextjs-app
pnpm build
```

## 関連記事

[WordPressをNext.js + MDXブログに移行した全手順](https://knym.net/blog/wordpress-to-nextjs-migration)

## License

MIT
