# ふたりログ

二人の希望を調整し、予定が崩れたら組み直し、確かめた記憶を次のデートに活かす Web アプリです。計画する側の1人だけが使います。相手用アカウントはありません。

このリポジトリの既定実行は **DEV（JSON ストア + 開発用トークン）** です。`APP_RUNTIME=LIVE` のときキーが無ければ BLOCKED であり、モックへ自動降格しません。LIVE 合格判定にはモックを使いません。

## 起動

```bash
cp .env.example .env.local   # 秘密は入れない。ENABLE_DEMO_CONTROLS=true を確認
npm install
npm run dev                  # Next.js と worker を同時起動
```

http://localhost:3000

- Web: `next dev`
- worker: PENDING の run を lease して処理

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run doctor          # PASS / FAIL / BLOCKED。秘密は出さない
npm run demo:live       # DEV 通し 1 回（LIVE 合格ではない）
npm run demo:five       # 同一版で 5 回。失敗で停止
npm run demo:reset      # 自分の isDemo データだけ。REPLAY は既定で残す
npm run replay:export -- <runId>
```

## デモの操作順

1. `/` でゲスト開始（Firebase 設定時は匿名ログイン、Google は利用可能なら追加）
2. `/today` で今日の候補カードを 3〜4 件選ぶか、「候補なしで条件だけ入れる」
3. `/plan/new` で集合地点を検索確定し、二人の希望・固定予定・自動変更を確認して作成
4. 行程を確認。雨・遅延・満席はシナリオ注入（デモ UID のみ）
5. 振り返り原文 → 確認質問 → 記憶候補を ID 付きで承認
6. 「この記憶を使って次のプランをつくる」

## Firebase Emulator

```bash
firebase emulators:start --only auth,firestore
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# APP_RUNTIME=EMULATOR
```

ルール: `firestore.rules`。クライアントは所有データの読取のみ。書き込みは Admin API。実プロジェクト接続成功を Emulator 成功としない。

デプロイ手順（公開はしない）: `npm run build` のあと Web と worker を同じ環境で起動。Firebase ルールは `firebase deploy --only firestore:rules`（このリポジトリからは公開しない）。

## 環境変数

`.env.example` を参照。値は捏造しません。

| 変数 | 用途 |
|---|---|
| `APP_RUNTIME` | `MOCK`/`DEV`（既定）または `LIVE` / Emulator |
| `ORCAROUTER_*` | [OrcaRouter](https://docs.orcarouter.ai/getting-started/quickstart) 実推論 |
| `GOOGLE_MAPS_API_KEY` | Places New / Routes |
| Firebase `NEXT_PUBLIC_*` / ADC | 匿名 Auth と Firestore。未設定時は DEV トークン |
| `ENABLE_DEMO_CONTROLS` | シナリオ注入。LIVE では `DEMO_ALLOWED_UIDS` に限定 |

## 画面

下部ナビは **今日 / プラン / ふたりのメモ**。PC では行程と判断トレースを併置します。

進捗と制約は `docs/implementation-status.md`、公式仕様確認は `docs/provider-verification.md`、LIVE 実測は `docs/live-results.md`。
