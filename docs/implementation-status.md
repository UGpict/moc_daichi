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
- `demo:five` は v0.4 §6.1。雨の承認待ち・確認質問なし・記憶影響なしは完全成功にしない。FAILED / BLOCKED / 部分成功と各条件判定を `docs/reports/criteria-61.json` に保存
- 振り返りは観察 / 仮説 / 確認済みを分離。HYPOTHESIS→OBSERVATION 変換と疲→STANDING 補完はしない。原因不明なら1問確認し、承認済みだけ次回に使う
- 上限付きツール選択ループが検証結果を次判断へ渡す。決定的な検証・適用ゲートはそのまま
- LIVE/EMULATOR の永続化は Admin Firestore。対象ドキュメント単位の読みと差分書き。全件 get / 全件書き戻しはしない
- 承認（PLAN_APPLY / MEMORY_*）と行程適用は Firestore `runTransaction`。JSON へ黙って落とさない
- 「カフェ」単語だけの好評記憶補完はしない
- ローカル LIVE は `gcloud auth application-default login` のユーザー ADC。`GOOGLE_APPLICATION_CREDENTIALS` や service_account 必須チェックはしない
- Cloud Agent は Firebase Auth/Firestore Emulator（projectId `futari-log-dev`）。未起動なら本番へ繋がない。Emulator 成功と LIVE 成功は別集計
- Cloud Run は常駐 worker を載せない。`POST /api/internal/jobs` で起動。lease / fencing / 承認トランザクションを維持。鍵ファイルなし（実行 SA の ADC）
- 画面の集計バナーは persist / LLM / Places / Routes を個別表示する。EMULATOR を「モック実行」と書かない

## 検証済み

- `npm test` に `tests/v08.test.ts` を追加
- このブランチの LIVE / `demo:five` 結果は `docs/live-results.md`

## BLOCKED

| 項目 | 理由 |
|---|---|
| Named Router `orcarouter/futari-*` | `/v1/models` に無く、API から作成できない。カタログ ID を使用 |
| 発表会場 | 住所・最寄り駅未提供 |
| Firestore Admin LIVE | Cloud Agent ではユーザー ADC が無い。LIVE 5連はローカル。ここでの確認は Emulator |
| Cloud Run デプロイ | 設定は `docs/deploy.md`。この VM からはデプロイしていない |
| LIVE AUTO_NOTIFY PASS | 実 Places の営業時間・料金 UNKNOWN → CONDITIONAL。CONDITIONAL を PASS にしない |

`sougi` 名称はリポジトリ内に残っていない。外部サービス側の旧表示は利用者設定。
