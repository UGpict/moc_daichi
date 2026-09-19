# 阻害要因

最終更新: 2026-09-19

| 項目 | 状態 | 利用者が用意するもの |
|---|---|---|
| Firebase Auth | PASS（この環境） | ウェブ API キーで匿名 `signUp` + `accounts:lookup`。ADC 無し |
| Firestore Admin | BLOCKED **CREDENTIALS**（権限不足・未設定ではない） | この環境の Runtime Secret `FIREBASE_SERVICE_ACCOUNT_JSON`。手順は `docs/adc-cloud-agent.md`。保存後は**新しい Agent** が必要。`.env.local` の `/path/to/service-account.json` はプレースホルダ |
| OrcaRouter | PASS（この環境） | キーあり。Named Router `orcarouter/futari-*` は未作成のため `/v1/models` の `openai/gpt-4o-mini` / `openai/gpt-4o` |
| Google Places / Routes | PASS（この環境） | Places New と Routes。過去の `departureTime` は送らない |
| 東京発表会場 | BLOCKED | 会場住所と最寄り駅。デモは名古屋駅 / 東京駅を設定切替 |
| LIVE AUTO_NOTIFY PASS | BLOCKED | 実データの UNKNOWN を PASS にしない。DEV の PASS 行程では AUTO_NOTIFY あり |
| 公式イベント開催確認 | BLOCKED | 許可した公式 API / 公式サイト。Places の「イベント」検索は会場候補 |
| 画面収録 | 手順のみ | `docs/demo-script.md` |

DEV 実行は独立して動作する。LIVE 合格判定には使わない。Emulator 成功を LIVE 成功としない。
