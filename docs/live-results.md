# LIVE 実行結果

最終更新: 2026-09-19

このファイルは実 LLM・実外部 API の通し結果だけを「LIVE 成功」と書く。モック合格は別に記す。秘密値は書かない。

## 対象 commit

作業ブランチ `cursor/futari-log-v07-f3e3`。

- 通し成功の実行 commit: `53f853e`
- モデル ID: `.env.local` の `ORCAROUTER_MUNDANE_MODEL=openai/gpt-4o-mini`、`ORCAROUTER_HARD_MODEL=openai/gpt-4o`（Named Router `orcarouter/futari-*` は公式 `/v1/models` に無く 400。カタログ実在 ID に差し替え）
- 解決モデル（応答 `model`）: mundane `gpt-4o-mini-2024-07-18`、hard `gpt-4o-2024-08-06`

## LIVE 通し

| 項目 | 結果 |
|---|---|
| 単発 `npm run demo:live` | **成功 1 / 1**（`docs/reports/demo-live.json`） |
| 5連 `npm run demo:five` | **1 本目成功、2 本目で停止**（連続 1 / 5） |
| モデル | 要求 `openai/gpt-4o-mini` + `openai/gpt-4o` → 実応答上記 |
| 単発時間 | 初回計画 4038ms / 雨再計画 3109ms / 遅延再計画 2927ms / 次回計画 3238ms（wall 約 25s） |
| 単発費用 | 計画系 hard 各約 0.379 JPY、振り返り mundane 約 0.012 JPY。1 通し合計 **約 1.53 JPY**（`usage.cost_usd` × 148.5） |
| 実行 ID（単発成功） | `run_145c9d62c1e399d5` INITIAL_PLAN SUCCEEDED / `run_df59949060f627b4` 雨 REPLAN WAITING_APPROVAL / `run_06256449b2e7d0f0` 遅延 REPLAN FAILED（FAIL 未適用） / `run_4ab1a4323234af1f` REFLECTION WAITING_APPROVAL / `run_eef8b1936102159a` NEXT_PLAN SUCCEEDED |

実データ:

- Firebase Identity Toolkit 匿名サインアップ（ADC ファイルはプレースホルダのため未使用。Admin 検証の代わりに `accounts:lookup`）
- Places: 名古屋駅 `ChIJiYvXlOd2A2ARYxYm-Esg94E`、愛知県美術館 `ChIJiaAgDi13A2ARt6jZobbCNuw`
- Routes: `DEMO_DATE` を Asia/Tokyo の当日（2026-09-20）へ合わせたあと computeRoutes は API 成功。過去の `departureTime` は送らない
- 初回行程は CONDITIONAL（営業時間・料金 UNKNOWN を 0 円/開いているとは断定しない）
- 雨シナリオは AUTO_NOTIFY せず承認待ち（CONDITIONAL のため。条件は緩和しない）
- 55 分遅延は実移動時間込みで `LATE_TO_END` 等の FAIL → **適用しない**（仕様どおり）
- 振り返り原文は承認後に記憶保存。当時の NEXT_DATE は作成元セッションに紐づいて次回計画の `memoryInfluences` が空だった。後続 commit で「未紐づけ NEXT_DATE は次セッションで読める」に直した

5連 2 本目（`run_0f02ef15ca8fd55d`）は INITIAL_PLAN が実 Routes で 4 件入り `LATE_TO_END` FAIL。モックの 0 分移動では起きない。失敗を成功に書き換えない。

## DEV/MOCK 通し（LIVE 合格ではない）

開発プロファイルの結果は `.data` と既存 `docs/reports` を参照。

## 自動適用デモ

実データで AUTO_NOTIFY 条件（PASS、費用増なし、移動増なし、MUST 維持、事前許可 ON）を満たすケースは未達。CONDITIONAL / FAIL を黙って PASS にしない。

## 残 BLOCKED

- 東京の発表会場住所・最寄り駅は未提供。デモは名古屋駅周辺を明示
- Firestore Admin（ADC）はプレースホルダパスのため未接続。永続化はこの環境では JSON ストア
- 画面収録は未収録
