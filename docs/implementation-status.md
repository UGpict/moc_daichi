# 実装状況（ふたりログ v0.8）

最終更新: 2026-09-19。完成済み・検証済み・未実装・BLOCKED を混同しない。

## 実装済み（コードあり）

- FAIL 自動再計画（最大 3：候補を外す / 滞在短縮 / 順入替 / TRANSIT）。尽きれば WAITING_INPUT。条件は緩めない
- 構造化 LLM: JSON Schema strict → 同モデル再試行 → hard エスカレート → 寛容パースは最終手段（`LLM_COERCED`）
- 全 LLM 呼び出しのトレース（モデル・理由・トークン・費用・レイテンシ）。セッション JSON で合計照合
- mundane/hard はタスク種別・入力サイズ・直前スキーマ失敗で明示ルーティング
- 信頼できない入力の区切り、記憶インジェクション警告、AUTO_NOTIFY 許可リスト、ログマスク
- `demo:chaos`（空入力、矛盾希望、閉店、400/429/timeout、過去出発）
- 判断トレース UI（開閉）。再計画差分・承認待ち記憶・累計費用
- 集合エリア切替（名古屋駅 / 東京駅）。発表会場そのものは未提供
- 記憶あり/なしの行程差分を `docs/reports/memory-plan-diff.json` に出力

## 検証済み

- `npm test` に `tests/v08.test.ts` を追加
- このブランチの LIVE / `demo:five` 結果は `docs/live-results.md`

## BLOCKED

| 項目 | 理由 |
|---|---|
| Named Router `orcarouter/futari-*` | `/v1/models` に無く、API から作成できない。カタログ ID を使用 |
| 発表会場 | 住所・最寄り駅未提供 |
| Firestore Admin | ADC がプレースホルダ。JSON ストア |
| LIVE AUTO_NOTIFY PASS | 実 Places の営業時間・料金 UNKNOWN → CONDITIONAL。CONDITIONAL を PASS にしない |

`sougi` 名称はリポジトリ内に残っていない。外部サービス側の旧表示は利用者設定。
