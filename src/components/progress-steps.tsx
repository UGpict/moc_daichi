import { StatusLabel } from "@/components/status-label";
import type { ProgressStep } from "@/lib/types";

export function ProgressSteps({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
              step.status === "done"
                ? "bg-forest text-white"
                : step.status === "current"
                  ? "bg-amber text-white"
                  : "bg-paper-deep text-ink-soft"
            }`}
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-medium text-ink">{step.label}</p>
              <StatusLabel
                status={
                  step.status === "done"
                    ? "confirmed"
                    : step.statusLabel === "返事待ち" || step.statusLabel === "回答待ち"
                      ? "waiting"
                      : "unconfirmed"
                }
                label={step.statusLabel}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
