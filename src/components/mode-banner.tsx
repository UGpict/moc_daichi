import { countedAsLabel, providersLine, type ProvidersView } from "@/domain/demo/providersDisplay";

export function SourceChip({ kind }: { kind: string }) {
  const label: Record<string, string> = {
    API: "取得",
    CACHE: "キャッシュ",
    ESTIMATED: "推定",
    INJECTED: "注入",
    USER: "入力",
    UNKNOWN: "不明",
  };
  return (
    <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[11px] text-ink-soft">
      {label[kind] ?? kind}
    </span>
  );
}

export function ModeBanner(props: {
  runtime: string;
  countedAs?: string;
  providers?: ProvidersView | null;
  mode?: string;
  overlays?: string[];
  replay?: boolean;
}) {
  if (props.replay) {
    return (
      <div className="rounded-xl bg-ink px-4 py-2 text-center text-sm text-white">
        録画済みの再生：外部APIも新規課金もしません
      </div>
    );
  }
  const counted = props.countedAs ?? props.runtime;
  const live = counted === "LIVE";
  const emulator = counted === "EMULATOR";
  const line = providersLine(props.providers);
  return (
    <div
      className={`rounded-xl px-4 py-2 text-sm ${live ? "bg-moss-soft text-moss" : emulator ? "bg-paper-deep text-ink" : "bg-amber-soft text-amber"}`}
    >
      <p>集計 {countedAsLabel(counted)}</p>
      {line ? <p className="mt-1 text-xs opacity-90">{line}</p> : null}
      {props.mode === "LIVE_SCENARIO" || (props.overlays && props.overlays.length > 0)
        ? ` ＋シナリオ注入（${(props.overlays ?? []).join("、") || "あり"}）`
        : null}
    </div>
  );
}
