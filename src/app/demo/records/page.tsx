"use client";

import { FamilyNav } from "@/components/family-nav";
import { useDemo } from "@/components/demo-provider";
import { Card, Notice, PageTitle } from "@/components/ui";
import { getMismatchNote, getRecordRows, recordsEyebrow } from "@/lib/case-records";
import { MUNICIPALITY } from "@/lib/sample-data";

const kindLabel = {
  clue: "手掛かり",
  matched: "照合・報告あり",
  mismatch: "不一致",
  waiting: "確認中",
};

export default function RecordsPage() {
  const { state } = useDemo();
  const rows = getRecordRows(state);
  const mismatch = getMismatchNote(state);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow={recordsEyebrow()}>情報・書類を確認する</PageTitle>
      <Notice>
        本人の発言は確認の手掛かりです。公的書類との照合が済んだ情報とは分けています。
        {MUNICIPALITY.note}
      </Notice>
      {mismatch ? (
        <Card>
          <h2 className="text-xl font-semibold">不一致・確認の根拠</h2>
          <p className="mt-3 text-lg leading-relaxed">{mismatch}</p>
        </Card>
      ) : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold">{row.label}</h2>
            <span className="shrink-0 rounded-full bg-paper-deep px-2 py-1 text-sm">
              {kindLabel[row.kind]}
            </span>
          </div>
          <dl className="mt-3 space-y-3 text-lg">
            <div>
              <dt className="text-base text-ink-soft">生前に本人から聞いたこと</dt>
              <dd>{row.leftover}</dd>
            </div>
            <div>
              <dt className="text-base text-ink-soft">死亡後に確認すること</dt>
              <dd>{row.afterDeath}</dd>
            </div>
          </dl>
        </Card>
      ))}
      <FamilyNav />
    </div>
  );
}
