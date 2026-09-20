/** クライアントからも読んでよい型だけ。fs / ADC はここへ置かない。 */

export type AppProfile = "DEV" | "EMULATOR" | "LIVE";
export type RuntimeMode = "MOCK" | "LIVE";
export type ProviderMode = "LIVE" | "MOCK" | "BLOCKED";
export type PersistTarget = "json" | "firestore-live" | "firestore-emulator";
