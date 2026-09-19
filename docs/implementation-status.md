# 実装状況（ふたりログ v0.7）

最終更新: 2026-09-19。完成済み・検証済み・未実装・BLOCKED を混同しない。

## 実装済み（コードあり）

- 日次候補カード、機能別 Container、単一オーケストレータ、Web/worker 分離を維持
- 選択 3 件以上でも AI 最終調整を実行。`assembleMode=MANUAL` だけが手動組み立て
- `ensureSpotFacts`：spot の存在だけでは詳細取得を省略しない
- Place / Occurrence 分離。Places のイベント検索は会場候補。開催確認済みとは表示しない
- SelectionDraft（API + namespace 付き sessionStorage）。候補なしは明示クリア
- LocationPicker：名前・ID・座標を一体で保存
- 希望の極性（LIKE/AVOID）。「歩きたくない」を散歩希望にしない
- 予算：食事・施設・交通を分離。0 円有効。既知部分超過は FAIL
- FAIL 案は適用しない（参考表示のみ）。承認でも拒否
- 完了済み・進行中・固定予定を検証と適用の両方で保護
- 記憶承認は candidateId + contentHash。文章部分一致は使わない
- reflection は専用スキーマ。原文（マスク）を LLM に渡し、返した質問・候補を使用
- LLM 試行を attempt 単位で記録。修正時の2試行を合算
- DEV は JSON ストア。Firestore は couple/session/planVersion/run/approval を個別ドキュメントとする tx ロジックを実装
- LIVE では mock トークン・mock ID を拒否。キー不足は MOCK へ落とさない
- Firebase Auth：未設定時は DEV トークン。設定時は匿名 + Google（利用可能な場合）
- UI：CandidateCard / SelectedSpotTray / LocationPicker / PreferenceSummary / 条件編集

## 検証済み（この環境で実行）

- `npm test` の回帰（極性、0円予算、FAIL 適用拒否、lease fencing、digest キー、壊れ JSON、振り返り JSON の coerce）
- LIVE 単発通し成功（commit `53f853e`）。Orca `openai/gpt-4o-mini` / `openai/gpt-4o`、Places、Routes、Firebase 匿名。詳細は `docs/live-results.md`
- 型検証はこの作業中に再実行

## 未実装 / 部分的

- Firestore Admin への実書き込みパスは JSON アダプタのまま。ADC 実ファイル待ち
- 公式イベント Occurrence の外部取得（許可サイト/公式 API）は未接続。未確認として施設カードで成立
- LIVE 5連は 1 本目成功・2 本目が実移動時間の FAIL で停止（連続 1 / 5）。条件は緩和しない
- 画面収録は未収録
- 既存 `.data/store.json` の破壊的移行は作っていない（ドライラン/エクスポート方針のみ。無断上書きしない）

## BLOCKED（利用者が入力すべき設定）

| 項目 | 必要なもの |
|---|---|
| Firestore LIVE | 実在する `GOOGLE_APPLICATION_CREDENTIALS`（この環境のパスはプレースホルダ） |
| 発表会場 | 東京の住所・最寄り駅。未提供のため開発デモは名古屋駅周辺を明示 |

LIVE 要求時にキーが無ければ失敗し、モックへ自動降格しない。Emulator 成功を LIVE 成功としない。
