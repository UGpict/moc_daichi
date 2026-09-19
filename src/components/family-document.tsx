import { Card } from "@/components/ui";
import { formatYen } from "@/lib/format";
import {
  CONFIRMATION_DATE,
  EXCLUDED_COSTS,
  FAMILY,
  FAMILY_FIRST_STEPS,
  FUNERAL_HOME,
  UNDECIDED_ITEMS,
  WISHES,
} from "@/lib/sample-data";
import type { CostBreakdown, CostConditions } from "@/lib/types";

export function FamilyDocument({
  conditions,
  breakdown,
}: {
  conditions: CostConditions;
  breakdown: CostBreakdown;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold">本人が大切にしたいこと</h2>
        <p className="mt-2 text-base">
          {FAMILY.principal}さんは、{WISHES.style}を希望しています。予算の目安は
          {formatYen(WISHES.budgetYen)}です。
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {WISHES.values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">準備できていること</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>一日葬の希望と、会葬者の目安（約20名）を共有している</li>
          <li>
            {FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}
            ）の見積もりを確認し、追加費用の条件を尋ねている
          </li>
          <li>安置延長、搬送超過、火葬料、飲食・返礼品の参考額を残している</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">まだ決まっていないこと</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {UNDECIDED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-paper-deep px-3 py-3 text-sm text-ink-soft">
          契約・予約はまだ行っていません。
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">費用の目安と前提</h2>
        <p className="mt-2 text-base">
          確認日：{CONFIRMATION_DATE}（架空の確認日です）
        </p>
        <ul className="mt-3 space-y-1 text-base">
          <li>安置日数：{conditions.stayDays}日</li>
          <li>搬送距離：{conditions.transportKm}km</li>
          <li>夜間搬送：{conditions.nightTransport ? "あり" : "なし"}</li>
          <li>飲食・返礼品：20名分を含む</li>
        </ul>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {breakdown.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-start justify-between gap-3 py-2"
            >
              <dt>
                <p>{line.label}</p>
                <p className="text-sm text-ink-soft">{line.note}</p>
              </dt>
              <dd className="shrink-0 font-medium tabular-nums">
                {formatYen(line.amount)}
              </dd>
            </div>
          ))}
          <div className="flex items-start justify-between gap-3 py-3">
            <dt className="font-semibold">参考合計</dt>
            <dd className="font-semibold tabular-nums">
              {formatYen(breakdown.total)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-soft">
          架空の条件に基づく参考額です。宗教者への謝礼など、含まれない費用があります。将来の価格や空き状況は保証されません。
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">
          必要になったときの確認先・確認事項
        </h2>
        <p className="mt-2 text-base">
          {FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}）
          <br />
          電話：{FUNERAL_HOME.phone}
          <br />
          担当：{FUNERAL_HOME.staff}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {FAMILY_FIRST_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <div className="mt-4">
          <h3 className="text-base font-medium">含まれない費用</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {EXCLUDED_COSTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
