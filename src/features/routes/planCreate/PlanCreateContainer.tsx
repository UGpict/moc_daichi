"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/common/auth/AuthContext";
import { ModeBanner } from "@/components/mode-banner";
import type { Me } from "@/lib/types";

function initialForm(me: Me) {
  const draftRaw = typeof window === "undefined" ? null : window.sessionStorage.getItem(`futari.draft.${me.uid}`);
  const parsed = draftRaw ? (JSON.parse(draftRaw) as { self?: string; partner?: string; partnerSource?: string }) : {};
  return {
    dateTokyo: me.demoDate,
    startTime: "13:00",
    endTime: "18:00",
    meetName: me.demoAreaName.includes("名古屋") ? "名古屋駅" : me.demoAreaName,
    endName: me.demoAreaName.includes("名古屋") ? "名古屋駅" : me.demoAreaName,
    meals: "8000",
    facilities: "4000",
    transit: "2000",
    self: parsed.self ?? "散歩と展示",
    partner: parsed.partner ?? "甘いもの",
    partnerSource: parsed.partnerSource ?? "PARTNER_STATEMENT_REPORTED",
    locked: true,
    auto: false,
  };
}

export function PlanCreateContainer() {
  const { me } = useAuth();
  if (!me) return null;
  return <PlanCreateForm me={me} />;
}

function PlanCreateForm({ me }: { me: Me }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => initialForm(me));

  async function submit() {
    if (!me) return;
    setBusy(true);
    setError(null);
    try {
      let coupleId = me.coupleId;
      if (!coupleId) {
        const created = await api<{ id: string }>("/api/couples", {
          method: "POST",
          body: JSON.stringify({ isDemo: true }),
        });
        coupleId = created.id;
      }
      const date = form.dateTokyo;
      const session = await api<{ sessionId: string }>(`/api/couples/${coupleId}/sessions`, {
        method: "POST",
        body: JSON.stringify({
          dateTokyo: form.dateTokyo,
          startTime: form.startTime,
          endTime: form.endTime,
          meet: { name: form.meetName, lat: me.demoLat, lng: me.demoLng, spotId: "mock:nagoya-station" },
          end: { name: form.endName, lat: me.demoLat, lng: me.demoLng, spotId: "mock:nagoya-station" },
          budget: {
            mealsJpy: Number(form.meals),
            facilitiesJpy: Number(form.facilities),
            transitJpy: Number(form.transit),
          },
          preferences: [
            { id: "pref_self", subject: "SELF", content: form.self, priority: "PREFER", source: "SELF_REPORT" },
            {
              id: "pref_partner",
              subject: "PARTNER",
              content: form.partner,
              priority: "MUST",
              source: form.partnerSource,
            },
          ],
          fixedAppointments: form.locked
            ? [
                {
                  id: "fix_art",
                  label: "愛知県美術館",
                  spotId: "mock:aichi-art-museum",
                  spotNameHint: "愛知県美術館",
                  startAt: `${date}T15:00:00+09:00`,
                  endAt: `${date}T16:00:00+09:00`,
                  kind: "TIME_FIXED",
                },
              ]
            : [],
          autoApply: {
            enabled: form.auto,
            acknowledgedScope: form.auto
              ? "未着手・非固定の1件差し替え、PASS、予算増なし、終了を遅らせない、移動増なし"
              : null,
            validUntil: form.auto ? new Date(Date.now() + 86400000).toISOString() : null,
          },
          travelMode: "WALK",
          areaName: me.demoAreaName,
          areaLat: me.demoLat,
          areaLng: me.demoLng,
          radiusMeters: 2500,
        }),
      });
      await api(`/api/sessions/${session.sessionId}/runs`, {
        method: "POST",
        headers: { "Idempotency-Key": `init-${session.sessionId}` },
        body: JSON.stringify({ kind: "INITIAL_PLAN" }),
      });
      router.push(`/plan/${session.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ModeBanner runtime={me.runtime} />
      <p className="text-sm text-ink-soft">条件 {step + 1} / 3 · デモ用プリセットはエリアと日付だけです。</p>
      {step === 0 ? (
        <Card>
          <h1 className="text-xl font-semibold">いつ・どこで</h1>
          <label className="mt-3 block text-sm">
            日付（Asia/Tokyo）
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2"
              value={form.dateTokyo}
              onChange={(e) => setForm({ ...form, dateTokyo: e.target.value })}
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm">
              開始
              <input type="time" className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </label>
            <label className="text-sm">
              終了
              <input type="time" className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            集合（公共地点）
            <input className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" value={form.meetName} onChange={(e) => setForm({ ...form, meetName: e.target.value })} />
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <label>
              食事
              <input className="mt-1 w-full rounded-xl border border-line bg-paper px-2 py-2" value={form.meals} onChange={(e) => setForm({ ...form, meals: e.target.value })} />
            </label>
            <label>
              施設
              <input className="mt-1 w-full rounded-xl border border-line bg-paper px-2 py-2" value={form.facilities} onChange={(e) => setForm({ ...form, facilities: e.target.value })} />
            </label>
            <label>
              交通
              <input className="mt-1 w-full rounded-xl border border-line bg-paper px-2 py-2" value={form.transit} onChange={(e) => setForm({ ...form, transit: e.target.value })} />
            </label>
          </div>
        </Card>
      ) : null}
      {step === 1 ? (
        <Card>
          <h1 className="text-xl font-semibold">二人の希望</h1>
          <label className="mt-3 block text-sm">
            自分（SELF）
            <input className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" value={form.self} onChange={(e) => setForm({ ...form, self: e.target.value })} />
          </label>
          <label className="mt-3 block text-sm">
            相手（伝聞または観察）
            <input className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })} />
          </label>
        </Card>
      ) : null}
      {step === 2 ? (
        <Card>
          <h1 className="text-xl font-semibold">固定予定と自動変更</h1>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.locked} onChange={(e) => setForm({ ...form, locked: e.target.checked })} />
            愛知県美術館 15:00–16:00 を時刻固定にする（予約済みとは表示しない）
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.auto} onChange={(e) => setForm({ ...form, auto: e.target.checked })} />
            自動変更を許可する（未着手1件・PASS・予算増なし・終了遅延なし）。初期値はOFF。
          </label>
        </Card>
      ) : null}
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <div className="flex gap-2">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            戻る
          </Button>
        ) : null}
        {step < 2 ? (
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
            次へ
          </Button>
        ) : (
          <Button className="flex-1" disabled={busy} onClick={() => void submit()}>
            {busy ? "行程を組み立てています…" : "プランをつくる"}
          </Button>
        )}
      </div>
    </div>
  );
}
