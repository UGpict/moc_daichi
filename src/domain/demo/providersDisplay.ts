import type { PersistTarget, ProviderMode } from "@/config/env";

export type ProvidersView = {
  persist: PersistTarget;
  llm: ProviderMode;
  places: ProviderMode;
  routes: ProviderMode;
};

export function persistLabel(persist: string | undefined): string {
  if (persist === "firestore-live") return "本物 Firestore";
  if (persist === "firestore-emulator") return "Firestore Emulator";
  if (persist === "json") return "JSON（DEV）";
  return persist ?? "不明";
}

export function connectionLabel(mode: string | undefined): string {
  if (mode === "LIVE") return "実接続";
  if (mode === "BLOCKED") return "BLOCKED";
  if (mode === "MOCK") return "モック";
  return mode ?? "不明";
}

export function countedAsLabel(countedAs: string | undefined): string {
  if (countedAs === "LIVE") return "LIVE（完全成功の対象）";
  if (countedAs === "EMULATOR") return "EMULATOR（LIVE成功に数えない）";
  if (countedAs === "DEV") return "DEV（LIVE成功に数えない）";
  return countedAs ?? "不明";
}

export function providersLine(providers?: ProvidersView | null): string {
  if (!providers) return "";
  return [
    `永続化 ${persistLabel(providers.persist)}`,
    `LLM ${connectionLabel(providers.llm)}`,
    `Places ${connectionLabel(providers.places)}`,
    `Routes ${connectionLabel(providers.routes)}`,
  ].join(" · ");
}
