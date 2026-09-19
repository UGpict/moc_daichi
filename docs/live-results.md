# LIVE 実行結果

最終更新: 2026-09-19

このファイルは実 LLM・実外部 API の通し結果だけを「LIVE 成功」と書く。モック合格は別に記す。

## 対象 commit

作業ブランチ `cursor/futari-log-v07-f3e3`。コミット SHA は git 履歴を参照。

## LIVE 通し

| 項目 | 結果 |
|---|---|
| 回数 | 0 / 5（未実施） |
| モデル | 未実行 |
| 時間 | 未計測 |
| 費用 | 未計上 |
| 実行 ID | なし |

理由: OrcaRouter / Google Maps / Firebase LIVE 資格情報がこの環境に揃っていない。自動で MOCK には落とさない。

## DEV/MOCK 通し（LIVE 合格ではない）

`npm run demo:live` と `npm run demo:five` は開発プロファイル用。結果は `.data` と既存 `docs/reports` を参照。v0.7 後の再実行は起動後に記録する。

## 自動適用デモ

実データで AUTO_NOTIFY 条件（PASS、費用増なし、移動増なし、MUST 維持、事前許可 ON）を満たすケースは、この環境では未達。条件を黙って緩和しない。
