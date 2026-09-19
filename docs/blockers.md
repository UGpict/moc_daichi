# 阻害要因

最終更新: 2026-09-19

| 項目 | 状態 | 利用者が用意するもの |
|---|---|---|
| Firebase Auth | PASS（この環境） | ウェブ API キーで匿名 `signUp` + `accounts:lookup`。ADC 無し |
| Firestore Admin | BLOCKED | 実在する ADC / `GOOGLE_APPLICATION_CREDENTIALS`。未接続時は JSON ストア |
| OrcaRouter | PASS（この環境） | キーあり。Named Router 未作成のため `/v1/models` の `openai/gpt-4o-mini` / `openai/gpt-4o` |
| Google Places / Routes | PASS（この環境） | Places New と Routes。過去の `departureTime` は送らない |
| 東京発表会場 | BLOCKED | 会場住所と最寄り駅。未提供のため開発デモは名古屋駅周辺を**明示**して使用 |
| LIVE 5連成功 | 途中失敗 | 単発は成功。5連 2 本目は実移動で FAIL（未適用）。モック連続は別 |
| 公式イベント開催確認 | BLOCKED | 許可した公式 API / 公式サイト。Places の「イベント」検索は会場候補 |
| 画面収録 | 未収録 | 成功した実実行の後 |

DEV 実行は独立して動作する。LIVE 合格判定には使わない。Emulator 成功を LIVE 成功としない。
