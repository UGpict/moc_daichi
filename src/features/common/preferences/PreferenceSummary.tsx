"use client";

export function PreferenceSummary(props: {
  preferences: {
    id: string;
    subject: string;
    content: string;
    priority: string;
    source?: string;
    polarity?: string;
  }[];
}) {
  return (
    <ul className="space-y-2 text-sm">
      {props.preferences.map((p) => (
        <li key={p.id}>
          <span className="text-ink-soft">
            {p.subject === "SELF"
              ? "自分"
              : p.source === "OBSERVATION"
                ? "相手（観察）"
                : p.source === "UNKNOWN"
                  ? "相手（未確認）"
                  : "相手（伝聞）"}{" "}
            / {p.priority}
            {p.polarity === "AVOID" ? " / 避けたい" : ""}
          </span>
          <div>{p.content}</div>
        </li>
      ))}
    </ul>
  );
}
