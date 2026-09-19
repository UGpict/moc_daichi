"use client";

import { FamilyDocument } from "@/components/family-document";
import { useDemo } from "@/components/demo-provider";
import {
  Card,
  Notice,
  PageTitle,
  PrimaryLink,
  SecondaryLink,
  StickyActions,
} from "@/components/ui";
import {
  addedConditionsDifference,
  calculateReferenceCost,
  RATES,
} from "@/lib/cost";
import { formatYen } from "@/lib/format";
import { areAnswersConfirmed } from "@/lib/inquiry";
import { CONFIRMATION_DATE, EXCLUDED_COSTS } from "@/lib/sample-data";
import { STAY_DAY_OPTIONS, TRANSPORT_KM_OPTIONS } from "@/lib/types";
import type { StayDays, TransportKm } from "@/lib/types";

export default function SummaryPage() {
  const { state, updateConditions } = useDemo();
  const confirmed = areAnswersConfirmed(state.inquiryStatus);
  const breakdown = calculateReferenceCost(state.conditions);
  const difference = addedConditionsDifference(breakdown.total);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle eyebrow="子どもに残す一枚">分かった条件で、目安の金額を見る</PageTitle>

      {!confirmed ? (
        <>
          <Notice>
            分からない費用が残っているので、合計はまだ出しません。書いていない項目を0円にはしません。
          </Notice>
          <StickyActions>
            <PrimaryLink href="/demo/agent">確認を続ける</PrimaryLink>
            <SecondaryLink href="/demo">準備に戻る</SecondaryLink>
          </StickyActions>
        </>
      ) : (
        <>
          <Card>
            <h2 className="text-xl font-semibold">条件を変えてみる</h2>
            <p className="mt-2 text-base text-ink-soft">
              安置は2日を超えた分だけ足します。搬送は20kmを超えた分を、10kmごとに切り上げます。
            </p>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-base font-medium">安置日数</span>
                <select
                  className="mt-1 min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base"
                  value={state.conditions.stayDays}
                  onChange={(event) =>
                    updateConditions({
                      stayDays: Number(event.target.value) as StayDays,
                    })
                  }
                >
                  {STAY_DAY_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {days}日
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-base font-medium">搬送距離</span>
                <select
                  className="mt-1 min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base"
                  value={state.conditions.transportKm}
                  onChange={(event) =>
                    updateConditions({
                      transportKm: Number(event.target.value) as TransportKm,
                    })
                  }
                >
                  {TRANSPORT_KM_OPTIONS.map((km) => (
                    <option key={km} value={km}>
                      {km}km
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend className="text-base font-medium">夜間搬送</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`min-h-11 rounded-lg border px-3 text-base ${
                      !state.conditions.nightTransport
                        ? "border-forest bg-forest text-white"
                        : "border-line bg-card text-ink"
                    }`}
                    onClick={() => updateConditions({ nightTransport: false })}
                  >
                    なし
                  </button>
                  <button
                    type="button"
                    className={`min-h-11 rounded-lg border px-3 text-base ${
                      state.conditions.nightTransport
                        ? "border-forest bg-forest text-white"
                        : "border-line bg-card text-ink"
                    }`}
                    onClick={() => updateConditions({ nightTransport: true })}
                  >
                    あり
                  </button>
                </div>
              </fieldset>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">目安の内訳</h2>
            <p className="mt-2 text-base text-ink-soft">
              最初の条件は、安置4日・搬送30km・日中搬送・飲食返礼品20名分です。
            </p>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {breakdown.lines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-start justify-between gap-3 py-2"
                >
                  <dt>
                    <p>{line.label}</p>
                    <p className="text-base text-ink-soft">{line.note}</p>
                  </dt>
                  <dd className="shrink-0 font-medium tabular-nums">
                    {formatYen(line.amount)}
                  </dd>
                </div>
              ))}
              <div className="flex items-start justify-between gap-3 py-3">
                <dt className="font-semibold">目安の合計</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatYen(breakdown.total)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-base">
              最初の見積額（基本プラン{formatYen(RATES.basePlan)}
              ）との差{formatYen(difference)}は、分かった条件を足した差額です。
            </p>
          </Card>

          <Notice>
            架空の条件に基づく目安です。宗教者への謝礼など、含まれない費用があります。将来の価格や空きは保証されません。必要になったときに、改めて確認してください。確認日は
            {CONFIRMATION_DATE}（架空）です。
          </Notice>

          <Card>
            <h2 className="text-xl font-semibold">含まれない費用</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {EXCLUDED_COSTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">子どもに残す一枚</h2>
            <FamilyDocument
              conditions={state.conditions}
              breakdown={breakdown}
            />
          </section>

          <StickyActions>
            <PrimaryLink href="/demo/family">子どもが見る画面を開く</PrimaryLink>
            <SecondaryLink href="/demo">準備に戻る</SecondaryLink>
          </StickyActions>
        </>
      )}
    </div>
  );
}
