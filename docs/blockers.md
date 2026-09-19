# 阻害要因

最終更新: 2026-09-19

| 項目 | 状態 | 利用者が用意するもの |
|---|---|---|
| Firebase Auth / Firestore LIVE | BLOCKED | プロジェクト、匿名 Auth、許可ドメイン、ADC。Emulator は別プロファイル |
| OrcaRouter | BLOCKED | `ORCAROUTER_API_KEY`、mundane/hard の Named Router 実名 |
| Google Places / Routes | BLOCKED | `GOOGLE_MAPS_API_KEY`（Places New と Routes を有効化） |
| 東京発表会場 | BLOCKED | 会場住所と最寄り駅。未提供のため開発デモは名古屋駅周辺を**明示**して使用 |
| LIVE 5連成功 | 未実施 | 上記キー。モック連続は `npm run demo:five` |
| 公式イベント開催確認 | BLOCKED | 許可した公式 API / 公式サイト。Places の「イベント」検索は会場候補 |
| 画面収録 | 未収録 | 成功した実実行の後 |

DEV 実行は独立して動作する。LIVE 合格判定には使わない。Emulator 成功を LIVE 成功としない。
