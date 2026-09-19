import { ESTIMATE, FAMILY, FUNERAL_HOME } from "@/lib/sample-data";
import { formatYen } from "@/lib/format";

export function EstimatePreview() {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
      <div className="border-b border-dashed border-line bg-paper-deep px-4 py-2 text-sm text-ink-soft">
        サンプル見積書（HTMLによるプレビューです）
      </div>
      <div className="space-y-4 px-4 py-5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ink-soft">
              {FUNERAL_HOME.name}
              <span className="ml-1">（{FUNERAL_HOME.fictionalNote}）</span>
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-wide">御見積書</h2>
          </div>
          <p className="text-right text-sm text-ink-soft">
            見積番号
            <br />
            {ESTIMATE.quoteNumber}
          </p>
        </div>

        <p className="text-base">
          {FAMILY.principal} 様
          <span className="block text-sm text-ink-soft">一日葬のご相談（事前準備）</span>
        </p>

        <div className="border-y border-line py-3">
          <div className="flex items-end justify-between gap-3">
            <p className="text-base font-medium">{ESTIMATE.title}</p>
            <p className="text-right text-xl font-semibold tabular-nums">
              {formatYen(ESTIMATE.basePlanYen)}
              <span className="block text-sm font-normal text-ink-soft">税込</span>
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink-soft">含まれるもの</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-base">
            {ESTIMATE.included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink-soft">記載上の注意</h3>
          <dl className="mt-2 divide-y divide-line border-y border-line">
            {ESTIMATE.notes.map((note) => (
              <div
                key={note.label}
                className="flex items-start justify-between gap-3 py-2 text-base"
              >
                <dt className="min-w-0">{note.label}</dt>
                <dd className="shrink-0 font-medium">{note.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="rounded-lg bg-amber-soft px-3 py-3 text-sm text-amber">
          基本プランの{formatYen(ESTIMATE.basePlanYen)}に、別途費用が加わる可能性があります。いまの総額は未確定です。
        </p>
      </div>
    </article>
  );
}
