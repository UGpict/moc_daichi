import type { ItemReviewStatus, ProgressStatus } from "@/lib/types";

const itemCopy: Record<ItemReviewStatus, { label: string; className: string }> = {
  unconfirmed: {
    label: "未確認",
    className: "bg-paper-deep text-ink-soft border-line",
  },
  waiting: {
    label: "回答待ち",
    className: "bg-amber-soft text-amber border-amber/30",
  },
  confirmed: {
    label: "確認済み",
    className: "bg-forest-soft text-forest border-forest/20",
  },
};

const progressCopy: Record<ProgressStatus, { label: string; className: string }> = {
  todo: {
    label: "未確認",
    className: "bg-paper-deep text-ink-soft border-line",
  },
  current: {
    label: "いま確認中",
    className: "bg-amber-soft text-amber border-amber/30",
  },
  done: {
    label: "確認済み",
    className: "bg-forest-soft text-forest border-forest/20",
  },
};

export function StatusLabel({
  status,
  label,
}: {
  status: ItemReviewStatus | ProgressStatus;
  label?: string;
}) {
  const preset =
    status in itemCopy
      ? itemCopy[status as ItemReviewStatus]
      : progressCopy[status as ProgressStatus];

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-sm font-medium ${preset.className}`}
    >
      {label ?? preset.label}
    </span>
  );
}
