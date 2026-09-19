"use client";

import { FamilyNav } from "@/components/family-nav";
import { useDemo } from "@/components/demo-provider";
import { Card, Notice, PageTitle } from "@/components/ui";
import { getTaskRows } from "@/lib/case-tasks";
import { MUNICIPALITY } from "@/lib/sample-data";

export default function TasksPage() {
  const { state } = useDemo();
  const rows = getTaskRows(state);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow="任せている手続き">誰が何を待ち、何を担当しているか</PageTitle>
      <Notice>
        家族の承認と、担当者の提出報告と、自治体の許可は別です。{MUNICIPALITY.note}
      </Notice>
      {rows.map((row) => (
        <Card key={row.id}>
          <h2 className="text-xl font-semibold">{row.actor}</h2>
          <p className="mt-2 text-lg">{row.work}</p>
          {row.waiting ? (
            <p className="mt-3 text-base text-amber">待ち：{row.waiting}</p>
          ) : (
            <p className="mt-3 text-base text-ink-soft">いま待っている返事はありません。</p>
          )}
        </Card>
      ))}
      <FamilyNav />
    </div>
  );
}
