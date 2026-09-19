"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/common/auth/AuthContext";
import { ModeBanner } from "@/components/mode-banner";
import { LocationPicker, type PickedPlace } from "@/features/common/location/LocationPicker";
import { SelectedSpotTray } from "@/features/common/candidates/SelectedSpotTray";
import { PreferenceSummary } from "@/features/common/preferences/PreferenceSummary";
import type { Me } from "@/lib/types";

type Form = {
  dateTokyo: string;
  startTime: string;
  endTime: string;
  meals: string;
  facilities: string;
  transit: string;
  self: string;
  partner: string;
  partnerSource: string;
  locked: boolean;
  auto: boolean;
  meet: PickedPlace | null;
  end: PickedPlace | null;
  selectedSpots: { spotId: string; name: string; lat: number; lng: number; intent: "MUST_VISIT" | "PREFER_VISIT" }[];
  draftId: string | null;
};

function defaultMeet(me: Me): PickedPlace {
  return {
    id: me.runtime === "LIVE" ? "" : "mock:nagoya-station",
    name: me.demoAreaName.includes("名古屋") ? "名古屋駅" : me.demoAreaName,
    lat: me.demoLat,
    lng: me.demoLng,
  };
}

export function PlanCreateContainer() {
  const { me } = useAuth();
  if (!me) return null;
  return <PlanCreateForm me={me} />;
}

function PlanCreateForm({ me }: { me: Me }) {
  const router = useRouter();
  const params = useSearchParams();
  const clearPicks = params.get("clearPicks") === "1";
  const meetDefault = useMemo(() => defaultMeet(me), [me]);
  const [form, setForm] = useState<Form>(() => ({
    dateTokyo: me.demoDate,
    startTime: "13:00",
    endTime: "18:00",
    meals: "8000",
    facilities: "4000",
    transit: "2000",
    self: "散歩と展示",
    partner: "甘いもの",
    partnerSource: "PARTNER_STATEMENT_REPORTED",
    locked: true,
    auto: false,
    meet: meetDefault.id ? meetDefault : null,
    end: meetDefault.id ? meetDefault : null,
    selectedSpots: [],
    draftId: null,
  }));
  const [editConditions, setEditConditions] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clearPicks) return;
    void (async () => {
      try {
        const data = await api<{ draft: { id: string; selectedSpots: Form["selectedSpots"] } | null }>("/api/drafts");
        if (data.draft?.selectedSpots?.length) {
          setForm((f) => ({
            ...f,
            selectedSpots: data.draft!.selectedSpots,
            draftId: data.draft!.id,
            locked: false,
            partner: "今日選んだ催しを一緒に回る",
            self: data.draft!.selectedSpots.map((s) => s.name).join("・"),
          }));
        }
      } catch {
        /* keep defaults */
      }
    })();
  }, [clearPicks]);

  const fromPicks = form.selectedSpots.length >= 1 && !clearPicks;

  async function submit() {
    if (!me) return;
    if (!form.meet || !form.end) {
      setError("集合と終了は検索候補から選んでください");
      return;
    }
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
      const live = me.runtime === "LIVE";
      const session = await api<{ sessionId: string }>(`/api/couples/${coupleId}/sessions`, {
        method: "POST",
        body: JSON.stringify({
          dateTokyo: form.dateTokyo,
          startTime: form.startTime,
          endTime: form.endTime,
          meet: {
            name: form.meet.name,
            lat: form.meet.lat,
            lng: form.meet.lng,
            spotId: form.meet.id || null,
            provider: form.meet.id.startsWith("mock:") ? "mock" : "places",
            resolved: Boolean(form.meet.id),
          },
          end: {
            name: form.end.name,
            lat: form.end.lat,
            lng: form.end.lng,
            spotId: form.end.id || null,
            provider: form.end.id.startsWith("mock:") ? "mock" : "places",
            resolved: Boolean(form.end.id),
          },
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
              priority: fromPicks ? "PREFER" : "MUST",
              source: form.partnerSource,
            },
          ],
          fixedAppointments:
            form.locked && !live
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
          areaId: "area:nagoya-station",
          areaLat: me.demoLat,
          areaLng: me.demoLng,
          radiusMeters: 2500,
          pickedSpotIds: form.selectedSpots.map((s) => s.spotId),
          selectedSpots: form.selectedSpots,
          draftId: form.draftId,
          assembleMode: "AI",
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

  const whenCard = (
    <Card>
      <h1 className="text-xl font-semibold">{fromPicks ? "時刻と予算" : "いつ・どこで"}</h1>
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
      <LocationPicker label="集合（公共地点）" value={form.meet} onChange={(v) => setForm({ ...form, meet: v })} />
      <LocationPicker label="終了地点" value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
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
      <p className="mt-2 text-[11px] text-ink-soft">初期値は二人分・食事と施設、交通は別枠。0円も有効です。</p>
    </Card>
  );

  return (
    <div className="space-y-4">
      <ModeBanner runtime={me.runtime} />
      {fromPicks ? (
        <>
          <SelectedSpotTray
            spots={form.selectedSpots}
            onRemove={(id) => setForm({ ...form, selectedSpots: form.selectedSpots.filter((s) => s.spotId !== id) })}
            onIntent={(id, intent) =>
              setForm({
                ...form,
                selectedSpots: form.selectedSpots.map((s) => (s.spotId === id ? { ...s, intent } : s)),
              })
            }
            onEditConditions={() => setEditConditions(true)}
          />
          <p className="text-sm text-ink-soft">選んだ候補は捨てません。最終調整は AI が実データで行います。</p>
        </>
      ) : (
        <p className="text-sm text-ink-soft">条件 {step + 1} / 3 · デモ用プリセットはエリアと日付だけです。</p>
      )}
      {fromPicks || step === 0 || editConditions ? whenCard : null}
      {(!fromPicks && step === 1) || editConditions ? (
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
          <label className="mt-3 block text-sm">
            相手情報の根拠
            <select
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2"
              value={form.partnerSource}
              onChange={(e) => setForm({ ...form, partnerSource: e.target.value })}
            >
              <option value="PARTNER_STATEMENT_REPORTED">相手が言った（伝聞）</option>
              <option value="OBSERVATION">自分の観察</option>
              <option value="UNKNOWN">不明</option>
            </select>
          </label>
          <div className="mt-3">
            <PreferenceSummary
              preferences={[
                { id: "s", subject: "SELF", content: form.self, priority: "PREFER", source: "SELF_REPORT" },
                { id: "p", subject: "PARTNER", content: form.partner, priority: fromPicks ? "PREFER" : "MUST", source: form.partnerSource },
              ]}
            />
          </div>
        </Card>
      ) : null}
      {(!fromPicks && step === 2) || editConditions ? (
        <Card>
          <h1 className="text-xl font-semibold">固定予定と自動変更</h1>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.locked} onChange={(e) => setForm({ ...form, locked: e.target.checked })} />
            愛知県美術館 15:00–16:00 を時刻固定にする（予約済みとは表示しない）
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.auto} onChange={(e) => setForm({ ...form, auto: e.target.checked })} />
            自動変更を許可する（未着手1件・PASS・予算増なし・終了遅延なし）。初期値はOFF。範囲を読んでからON。
          </label>
        </Card>
      ) : null}
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <div className="flex gap-2">
        {!fromPicks && step > 0 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            戻る
          </Button>
        ) : null}
        {fromPicks || step >= 2 || editConditions ? (
          <Button className="flex-1" disabled={busy} onClick={() => void submit()}>
            {busy ? "候補と希望から組み立てています…" : "プランをつくる"}
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
            次へ
          </Button>
        )}
      </div>
    </div>
  );
}
