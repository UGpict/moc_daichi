# この Cloud Agent 環境へ Firebase Admin 認証を渡す

秘密鍵・PEM・サービスアカウント JSON 本文はチャット・Git・コミット・ログに出さない。
この文書は手順だけを書く。値はダッシュボードの入力欄にだけ貼る。

## 対象

- Cursor Personal environment: `3af29154-b3e9-11f1-bb68-864e54d14197`
- ダッシュボード: https://cursor.com/dashboard/cloud-agents/environments/e/3af29154-b3e9-11f1-bb68-864e54d14197
- 公式: https://cursor.com/docs/cloud-agent/security-network
- コードが読む名前: **`FIREBASE_SERVICE_ACCOUNT_JSON`**（JSON 本文）

Runtime Secret はエージェント**起動時**にだけ注入される。保存しただけでは、いま動いている VM には届かない。

## 手順

1. Firebase Console でプロジェクト `futari-log-agent` のサービスアカウント JSON を**自分の端末だけ**にダウンロードする。チャットに貼らない。
2. 上の環境ダッシュボードを開く。
3. **Runtime Secret**（旧 Redacted Secret）を 1 件追加する。
   - Name: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - Value: ダウンロードした JSON **全文**（`{` から `}` まで）
   - Environment Variable ではなく Runtime Secret にする。本文がチャット・ツール結果・コミットから `[REDACTED]` になる。
4. 保存する。JSON ファイルは手元から消してよい。リポジトリの `.env*` や `.secrets/` には置かない。
5. **新しい Cloud Agent を起動**する（このブランチ / この PR を指定）。既存の実行には注入されない。
6. 新しい Agent で `npm run persist:diagnose` を実行する。`kind` が `ok` なら probe の読み書きも同スクリプトが試す。
7. その後 `npm run demo:five`（LIVE）。

## コード側の扱い

- `FIREBASE_SERVICE_ACCOUNT_JSON` が JSON なら `/tmp/futari-adc.json`（mode `0600`）へ展開し、`GOOGLE_APPLICATION_CREDENTIALS` をそのパスにする。
- 展開後、プロセス上の JSON 本文は消す。ログには basename と成否だけ出す。
- `GOOGLE_APPLICATION_CREDENTIALS` が `{` で始まる場合も同じ（誤ってパスではなく JSON を入れたとき）。
- 実ファイルパスが既にあればそれを使う。`/path/to/service-account.json` はプレースホルダとして拒否する。

## やってはいけないこと

- 秘密鍵をチャット・PR・issue・`docs/`・`.env.local` のコミットに書く
- `cat` や `echo` で ADC ファイルや secret を出す
- 既存 Agent のシェルに後から鍵を貼る（ログに残る）

権限不足（PERMISSION）や Firestore 未作成（NOT_CONFIGURED）は、ADC が通ったあとで初めて分かる。
