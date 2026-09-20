# 実行環境とデプロイ

サービスアカウント鍵は発行しない。チャット・Git・ログに秘密を出さない。

## 3 つの実行環境

| 場所 | 永続化 | 認証 | 集計 |
|---|---|---|---|
| Cursor Cloud Agent | Firebase Auth / Firestore **Emulator** | 鍵なし。projectId `futari-log-dev` | **EMULATOR**。LIVE に数えない |
| 自分の PC | 本物の Firestore | `gcloud auth application-default login` のユーザー ADC | **LIVE**（完全成功の対象） |
| 公開（Cloud Run） | 本物の Firestore | サービスに割り当てた SA の ADC。鍵ファイルなし | **LIVE** |

LLM はどの環境でも OrcaRouter。Places / Routes は LIVE のときだけ実接続。Emulator / DEV では MOCK。`providers.*` と `countedAs` を別表示する。

## 手元で必要な操作（LIVE）

この Cloud Agent では実行しない。自分の PC で:

```bash
gcloud auth application-default login
# 必要なら: gcloud config set project <Firebase のプロジェクト ID>
cd <リポジトリ>
# .env.local に APP_RUNTIME=LIVE と OrcaRouter / Maps / Firebase ウェブ設定。
# GOOGLE_APPLICATION_CREDENTIALS は置かない。仮パスがあれば削除する。
npm run persist:diagnose
npm run demo:five
```

成功したら `docs/live-results.md` の LIVE 欄を更新する。Emulator 成功と混ぜない。

失敗時は `docs/reports/persist-diagnosis.json` の kind を見る。

| kind | 意味 | 手元ですること |
|---|---|---|
| CREDENTIALS | ADC が無い / 無効 | `gcloud auth application-default login` をやり直す |
| PERMISSION | プロジェクトへ届いたが権限不足 | 自分の Google アカウントに Firestore の権限を付ける |
| NOT_CONFIGURED | Firestore DB が無い | Firebase コンソールで Firestore を作る |
| CONNECT | ネットワーク | プロキシ・ファイアウォール |

## Cloud Run（公開）

常駐の `tsx src/worker/index.ts` は載せない。Web が PENDING を作り、HTTP（または Cloud Tasks）でジョブを起動する。lease / fencing / heartbeat / 承認トランザクションはそのまま。

### イメージ

`Dockerfile` は Next.js `output: 'standalone'`。ジョブは `POST /api/internal/jobs`。タイムアウトは計画 90 秒より長くする（300 秒）。

### サービス

同一イメージを 2 サービスにする。

1. `futari-log`（Web）  
   `WORKER_MODE=http`  
   `WORKER_INVOKE_URL=https://<worker の URL>`  
   `--cpu-boost` 可。リクエスト課金のままでよい。
2. `futari-log-worker`（ジョブ）  
   同じイメージ。`--timeout 300` `--concurrency 4`  
   CPU はリクエスト中だけあればよい（ジョブ HTTP が実行時間を持つ）。

任意: Cloud Tasks キューを作り `CLOUD_TASKS_QUEUE=projects/<p>/locations/<r>/queues/futari-jobs` を Web に渡す。未設定なら Web が Worker URL へ HTTP POST する。

### デプロイ例（値は自分のプロジェクトに置き換える）

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>

gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  artifactregistry.googleapis.com

gcloud iam service-accounts create futari-log-run \
  --display-name="futari-log Cloud Run"

# 鍵は作らない。create-key しない。
# keys create は使わない。

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:futari-log-run@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:futari-log-run@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:futari-log-run@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# Cloud Tasks を使うときだけ:
# gcloud projects add-iam-policy-binding <PROJECT_ID> \
#   --member="serviceAccount:futari-log-run@<PROJECT_ID>.iam.gserviceaccount.com" \
#   --role="roles/cloudtasks.enqueuer"

# Worker サービスへ Web から呼ぶ権限（デプロイ後）
# gcloud run services add-iam-policy-binding futari-log-worker \
#   --member="serviceAccount:futari-log-run@<PROJECT_ID>.iam.gserviceaccount.com" \
#   --role="roles/run.invoker"

gcloud builds submit --tag <REGION>-docker.pkg.dev/<PROJECT_ID>/futari/futari-log

gcloud run deploy futari-log-worker \
  --image <REGION>-docker.pkg.dev/<PROJECT_ID>/futari/futari-log \
  --service-account futari-log-run@<PROJECT_ID>.iam.gserviceaccount.com \
  --timeout 300 \
  --env-vars-file deploy/cloudrun.env.yaml \
  --set-env-vars WORKER_MODE=http \
  --set-secrets ORCAROUTER_API_KEY=ORCAROUTER_API_KEY:latest,GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest,WORKER_SHARED_SECRET=WORKER_SHARED_SECRET:latest

gcloud run deploy futari-log \
  --image <REGION>-docker.pkg.dev/<PROJECT_ID>/futari/futari-log \
  --service-account futari-log-run@<PROJECT_ID>.iam.gserviceaccount.com \
  --env-vars-file deploy/cloudrun.env.yaml \
  --set-env-vars WORKER_MODE=http,WORKER_INVOKE_URL=https://<worker-url> \
  --set-secrets ORCAROUTER_API_KEY=ORCAROUTER_API_KEY:latest,GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest,WORKER_SHARED_SECRET=WORKER_SHARED_SECRET:latest
```

Firebase の `NEXT_PUBLIC_*` と `FIREBASE_PROJECT_ID` は Secret ではなく環境変数でよい（クライアントに出る値）。

この VM からはデプロイしていない。

Vercel には常駐 worker も実行 SA の ADC も無い。`VERCEL=1` のときは:

- `WORKER_MODE=sync` 相当で、計画を同じ HTTP リクエスト内で実行する
- Firestore の `applicationDefault()` は metadata 待ちせず CREDENTIALS にする（`/api/me` が返らずボタンが準備中のまま止まるのを防ぐ）。LIVE は JSON へ落とさない
- Hobby の 10 秒制限だと INITIAL_PLAN（最大 90 秒）は途中で切れる

公開の LIVE は Cloud Run（timeout 300、割り当て SA）を使う。Vercel で見た目だけ回すなら Environment Variables は空のままでよい（未設定は `MOCK`）。デプロイ FS には書けないので JSON ストアは `/tmp/futari-log`（インスタンスごとに消える）。`cursor/futari-log-v04-61-f3e3` を Promote to Production する。今の Production を Redeploy しない。

## Secret Manager

サーバー側だけで扱う。クライアントに出さない。

| Secret | 用途 |
|---|---|
| `ORCAROUTER_API_KEY` | LLM。OrcaRouter 必須 |
| `GOOGLE_MAPS_API_KEY` | Places New / Routes |
| `WORKER_SHARED_SECRET` | Web→Worker のジョブ起動 |

```bash
printf '%s' "$ORCAROUTER_API_KEY" | gcloud secrets create ORCAROUTER_API_KEY --data-file=-
# 既存なら add-version
```

## IAM（実行 SA `futari-log-run`）

必要最小限。鍵作成権限は付けない。

| ロール | 理由 |
|---|---|
| `roles/datastore.user` | Firestore 読み書き |
| `roles/firebaseauth.admin` | Admin での ID トークン検証（過剰なら Identity Toolkit の狭いロールに落とす） |
| `roles/secretmanager.secretAccessor` | 上記 Secret |
| `roles/run.invoker`（Worker サービスに対して） | Web / Cloud Tasks からジョブ HTTP |
| `roles/cloudtasks.enqueuer` | `CLOUD_TASKS_QUEUE` を使うときだけ |

自分のユーザー（ローカル LIVE）には Firestore の編集相当。Cloud Run SA とは別。

## 有効化する API

- Cloud Run
- Secret Manager
- Cloud Firestore
- Identity Toolkit / Firebase Auth
- Artifact Registry（または Cloud Build）
- Cloud Tasks（キューを使うとき）
- Maps: Places API (New)、Routes API（キー側）

## ジョブの保証

| 項目 | 実装 |
|---|---|
| 起動 | `startRun` のあと `enqueueRun`。画面の GET でも PENDING を再投入 |
| 再試行 | 起動失敗は再投入。claim は最大 3 回。lease 切れ実行中は INTERRUPTED（最初からやり直さない） |
| 二重実行 | lease + fencing token。他 Worker の heartbeat 中は claim しない |
| タイムアウト | `executeRun` の AbortController（INITIAL_PLAN 90s）。Cloud Run `--timeout 300` |
| 進捗 | 既存 events / run.status。セッション GET が `providers` と `countedAs` を返す |
| 承認・適用 | Firestore `runTransaction`。heartbeat の stale lease は拒否 |

## Cloud Agent

```bash
npm run persist:diagnose:emu
npm run demo:emu:five
```

鍵不要。未起動なら CONNECT で止め、本番へ繋がない。
