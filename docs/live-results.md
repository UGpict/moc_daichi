# LIVE 実行結果

最終更新: 2026-09-19

このファイルは実 LLM・実外部 API の通し結果だけを「LIVE 成功」と書く。モック合格は別に記す。秘密値は書かない。

## 対象 commit

作業ブランチ `cursor/futari-log-v08-f3e3`。

- 通し成功の実行 commit: `7a808ca`
- モデル ID: `.env.local` の `ORCAROUTER_MUNDANE_MODEL=openai/gpt-4o-mini`、`ORCAROUTER_HARD_MODEL=openai/gpt-4o`（Named Router `orcarouter/futari-*` は公式 `/v1/models` に無く **BLOCKED**。カタログ実在 ID）
- 解決モデル: mundane `gpt-4o-mini-2024-07-18`、hard `gpt-4o-2024-08-06`
- スキーマ: この連の集計は呼び出し 31、失敗率 0%、再試行率 0%、エスカレート率 0%、strict 成功 6（`docs/reports/llm-schema.md`）

## LIVE 通し（v0.8）

| 項目 | 結果 |
|---|---|
| 単発 `npm run demo:live` | **成功 1 / 1**（`docs/reports/demo-live.json`） |
| 5連 `npm run demo:five` | **成功 5 / 5**（連続。v0.7 は 1/5 で `LATE_TO_END` 停止） |
| 再計画 | 5 本とも INITIAL_PLAN で **1 回**（合計 5）。条件は緩めていない |
| モデル | 要求 `openai/gpt-4o-mini` + `openai/gpt-4o` |
| 5連 平均所要 | 計画系ステップ平均 **約 5.9s**、1 通し wall（計画+雨+遅延+次回の duration 合計）平均 **約 24s** |
| 5連 平均費用 | セッション LLM 合計平均 **約 1.29 JPY**（トレース合計 = run.cost。`matchesSum=true`） |
| 単発 | INITIAL_PLAN 12627ms / 雨 5567ms / 遅延 5869ms / 次回 6602ms。セッション LLM **1.51 JPY**、再計画 1 |

実データ:

- Firebase Identity Toolkit 匿名サインアップ（ADC プレースホルダは未使用）
- Places: 名古屋駅 `ChIJiYvXlOd2A2ARYxYm-Esg94E`、愛知県美術館 `ChIJiaAgDi13A2ARt6jZobbCNuw`
- 初回行程は CONDITIONAL（営業時間・料金 UNKNOWN を開いている/0円とは断定しない）
- `LATE_TO_END` は MUST の店を残し滞在短縮または TRANSIT で再検証。FAIL のままなら適用しない
- 雨シナリオは AUTO_NOTIFY せず承認待ち（CONDITIONAL のため）
- 振り返り原文は承認後に記憶保存。2 本目の行程は 1 本目と店順が変わる（`memory-plan-diff.json`）
- セッション LLM トレースの費用合計は run.cost と一致

## DEV/MOCK

- `npm test` 45 件パス（`tests/v08.test.ts` を含む）
- `APP_RUNTIME=MOCK npm run demo:chaos` 11 ケースすべて ok（空入力 HUMAN、矛盾希望 HUMAN、閉店 RETRY、429/timeout RETRY、400 HUMAN、過去出発 FALLBACK、注入 WARN、通知先 BLOCK）

## 自動適用デモ

実データで AUTO_NOTIFY 条件（PASS、費用増なし、移動増なし、MUST 維持、事前許可 ON）を満たすケースは未達。CONDITIONAL / FAIL を黙って PASS にしない。**P1-7 BLOCKED**。

## 残 BLOCKED

- Named Router `orcarouter/futari-*` は `/v1/models` に無く作成できない
- 東京の発表会場住所・最寄り駅は未提供。デモは名古屋駅 / 東京駅を設定切替
- Firestore Admin（ADC）はプレースホルダ。永続化はこの環境では JSON ストア
- 画面収録は手順のみ（`docs/demo-script.md`）
