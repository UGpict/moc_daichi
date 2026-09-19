# 公式資料の確認ログ（2026-09-19）

秘密値は記載しない。アプリの環境変数名はベンダー仕様ではない。

## OrcaRouter

- 入口: [Quickstart](https://docs.orcarouter.ai/getting-started/quickstart.md)
- Chat Completions: `POST {base}/chat/completions`（既定 base `https://api.orcarouter.ai/v1`）
- OpenAI 互換。`Authorization: Bearer sk-orca-...`
- 構造化: [Structured outputs](https://docs.orcarouter.ai/advanced/structured-outputs.md)
  - `response_format: { type: "json_object" }` と `json_schema` を確認
  - Anthropic 上流は `response_format` 非対応。送るモデルを Named Router 側で OpenAI/Gemini/Grok 系に限定する
- 料金: [Per-request cost](https://docs.orcarouter.ai/operations/per-request-cost.md)
  - ヘッダー `X-OrcaRouter-Include-Cost: true` で `usage.cost_usd`
- Named Router: [named-routers](https://docs.orcarouter.ai/routing/named-routers)
  - 呼び出しは `model: "orcarouter/{name}"`
  - ダッシュボード未作成の名前を想像して送らない。未作成なら BLOCKED

実装: `src/server/llm/index.ts`。LIVE でキーが無ければ BLOCKED（モック推論へ落とさない）。DEV は `mock/planner-v0.7`。

確認日: 2026-09-19。料金ヘッダーは [Per-request cost](https://docs.orcarouter.ai/operations/per-request-cost.md) の `X-OrcaRouter-Include-Cost` と `usage.cost_usd` を採用。独自ヘッダーは正しいと仮定しない。resolved model は応答ヘッダーがあれば `actualModel`、無ければ `unknown`。

## Google Places API (New)

- Nearby Search: `POST https://places.googleapis.com/v1/places:searchNearby`
- FieldMask 必須。検索は `places.id,places.displayName,places.location,places.types,places.primaryType,places.googleMapsUri,places.photos.name,places.photos.authorAttributions.displayName`
- 写真: `GET https://places.googleapis.com/v1/{places/*/photos/*}/media?maxWidthPx=800&skipHttpRedirect=true`
  - アプリは `/api/places/photo?name=` でプロキシする。任意URLの取得はしない
  - 帰属は `authorAttributions.displayName` を表示
  - 写真が無い候補は「写真未取得」とし、生成画像では埋めない
- Details は `id,displayName,location,types,primaryType,websiteUri,googleMapsUri,regularOpeningHours,currentOpeningHours,priceLevel,priceRange,businessStatus`
- `priceRange` が無い場合は円額を作らず UNKNOWN
- Text Search: `POST https://places.googleapis.com/v1/places:searchText`（催し・展覧会の日次取得）
  - 開催中チケットの公式確認ではない。取得クエリと時刻を表示する
- 日次ダイジェストは worker が Asia/Tokyo の日付で一日一回取得し、デート作成時は都度検索しない

## Google Routes API

- `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- `travelMode`: `WALK` / `TRANSIT` / `DRIVE` を確認
- `departureTime` は RFC3339。過去の出発は TRANSIT のみ
- FieldMask: `routes.duration,routes.distanceMeters`
- LIVE で失敗したとき直線距離を実移動時間として使わない

## Open-Meteo

- `GET https://api.open-meteo.com/v1/forecast`
- 必須: latitude, longitude
- hourly `precipitation,weather_code`
- 既定 7 日、最大 16 日
- キー不要。doctor で実疎通する
