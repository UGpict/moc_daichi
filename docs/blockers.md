# 阻害要因

最終更新: 2026-09-19

| 項目 | 状態 | 利用者が用意するもの |
|---|---|---|
| Firebase Auth | PASS（この環境） | ウェブ API キーで匿名 `signUp` + `accounts:lookup`。ADC 無し |
| Firestore Admin（LIVE） | ローカルでユーザー ADC | `gcloud auth application-default login`。Cloud Agent では LIVE 5連をしない |
| Cloud Run | 設定のみ | 実行 SA・Secret・IAM は `docs/deploy.md`。この VM からはデプロイしていない |
| Firestore / Auth Emulator | Cloud Agent で使用 | `npm run persist:diagnose:emu` / `demo:emu:five`。未起動なら CONNECT で停止。本番へは繋がない |
| OrcaRouter | PASS（この環境） | キーあり。Named Router `orcarouter/futari-*` は未作成のため `/v1/models` の `openai/gpt-4o-mini` / `openai/gpt-4o` |
| Google Places / Routes | PASS（この環境） | Places New と Routes。過去の `departureTime` は送らない |
| 東京発表会場 | BLOCKED | 会場住所と最寄り駅。デモは名古屋駅 / 東京駅を設定切替 |
| LIVE AUTO_NOTIFY PASS | BLOCKED | 実データの UNKNOWN を PASS にしない。DEV の PASS 行程では AUTO_NOTIFY あり |
| 公式イベント開催確認 | BLOCKED | 許可した公式 API / 公式サイト。Places の「イベント」検索は会場候補 |
| 画面収録 | 手順のみ | `docs/demo-script.md` |

DEV 実行は独立して動作する。LIVE 合格判定には使わない。Emulator 成功を LIVE 成功としない。
