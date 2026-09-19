# 認証：ローカルはユーザー ADC、Cloud Agent は Emulator

サービスアカウント鍵は使わない。チャット・Git・ログに秘密を出さない。

## ローカル（本物の Firestore）

1. `gcloud auth application-default login` でユーザー ADC を入れる。
2. `APP_RUNTIME=LIVE`。`GOOGLE_APPLICATION_CREDENTIALS` は不要。
3. Firebase Admin は `applicationDefault()` で解決する。`type=service_account` チェックはしない。
4. 接続結果で CREDENTIALS / PERMISSION / NOT_CONFIGURED を分ける。
5. 本物の Firestore を含む LIVE 5 連は **このマシンで** `npm run demo:five`。Cloud Agent の Emulator 成功とは別集計。

仮のパス（`/path/to/service-account.json`）は読み込んだあと削除する。applicationDefault がユーザー ADC を見つけられるようにするため。

## Cloud Agent（Firebase Emulator）

1. `npm run persist:diagnose:emu` または `npm run demo:emu:five`
2. Auth `127.0.0.1:9099` と Firestore `127.0.0.1:8080`、projectId `futari-log-dev` で揃える
3. 鍵なしで persist 診断とデモ確認ができる
4. Emulator 未起動なら CONNECT で明示停止し、本番プロジェクトへは接続しない

## 集計

| countedAs | 永続化 | 合格ラベル |
|---|---|---|
| LIVE | 本物 Firestore | 完全成功 |
| EMULATOR | Emulator | EMULATOR成功 |
| DEV | JSON | 部分成功（LIVE に数えない） |

LLM / Places / Routes は `providers.llm` `providers.places` `providers.routes` が `LIVE` か `MOCK` かを別表示する。
