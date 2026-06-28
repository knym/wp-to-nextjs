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
├── wp-to-nextjs/          ← このリポジトリ（scripts として clone する）
├── data-WP/               ← WordPress エクスポートを置く（git 管理外・絶対に公開しない）
│   └── export.xml         ← WXR ファイル（管理画面からダウンロード）
├── data-GSC/              ← Search Console データを置く（git 管理外・絶対に公開しない）
│   └── pages.csv          ← ページ別クリック数 CSV（GSC からエクスポート）
└── your-nextjs-app/       ← 移行先の Next.js プロジェクト
    ├── content/posts/
    └── public/img/
```

> **注意:** `data-WP/` と `data-GSC/` は個人情報・アクセスデータを含みます。`.gitignore` に追加して絶対に git 管理しないでください。

### WXR ファイルの取得方法

WordPress 管理画面 → ツール → エクスポート → 投稿 → 「エクスポートファイルをダウンロード」

### GSC CSV の取得方法

Search Console → 検索パフォーマンス → ページ → クリック数で降順ソート → エクスポート → CSV

## セットアップ

```bash
git clone https://github.com/knym/wp-to-nextjs.git scripts
cd scripts
npm install
```

## 設定

各スクリプトの上部に `CONFIG` セクションがあります。環境変数または直接編集で変更してください。

| 変数 | デフォルト | 説明 |
|---|---|---|
| `SITE_URL` | `https://example.com` | WordPress サイトの URL |
| `IMG_DIR` | `../your-nextjs-app/public/img/` | 画像の保存先 |
| `MDX_DIR` | `../your-nextjs-app/content/posts/` | MDX の出力先 |

```bash
# 例: 環境変数で指定
SITE_URL=https://yoursite.com IMG_DIR=../myapp/public/img/ node download-images.mjs
```

## 実行手順

### 事前準備

1. WordPress 管理画面 → ツール → エクスポート → 投稿 → XML をダウンロード
2. `wordpress-export/export.xml` として保存
3. GSC の検索パフォーマンス CSV と照合し、移行する記事のスラッグを決定
4. `target-slugs.json` を作成

```json
["post-slug-a", "post-slug-b", "post-slug-c"]
```

### Step 1: WXR を解析

```bash
node parse-wxr.mjs
# または WXR ファイルのパスを引数で渡す
node parse-wxr.mjs ../wordpress-export/export.xml
```

`posts-list.json`（一覧確認用）と `posts-full.json`（変換用）を生成します。
`posts-list.json` を GSC の CSV と照らし合わせて `target-slugs.json` を確定してください。

### Step 2: 画像をダウンロード

```bash
SITE_URL=https://yoursite.com node download-images.mjs
```

`public/img/` に画像を保存し、`image-map.json`（WordPress URL → ローカルパスの対応表）を生成します。

### Step 3: MDX に変換

```bash
node convert-to-mdx.mjs
```

`target-slugs.json` に含まれる記事を MDX に変換して `content/posts/` に書き出します。

変換後は各ファイルを目視確認してください：

- `[caption]` `[gallery]` 等のショートコードが残っていないか
- コードブロックの言語指定（` ```bash ` など）が正しいか
- 画像パスが `/img/xxx` になっているか

### Step 4: リダイレクト設定を生成

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

### Step 5: ビルド確認

```bash
cd ../your-nextjs-app
pnpm build
```

## .gitignore について

以下は個人情報・サイト固有データを含むため git 管理外にしています：

- `posts-full.json` — 記事本文（WordPress の全コンテンツ）
- `posts-list.json` — 記事一覧（タイトル・スラッグ等）
- `image-map.json` — 画像 URL マッピング
- `redirects-output.json` — 生成されたリダイレクト設定
- `target-slugs.json` — 移行対象スラッグリスト

## 関連記事

[WordPressをNext.js + MDXブログに移行した全手順](https://knym.net/blog/wordpress-to-nextjs-migration)

## License

MIT
