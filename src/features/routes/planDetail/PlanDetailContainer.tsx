"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CostBadge } from "@/components/cost-badge";
import { ModeBanner } from "@/components/mode-banner";
import { SpotCard } from "@/components/plan/spot-card";
import { useSessionPoll } from "@/hooks/useSessionPoll";
import { cn } from "@/lib/cn";
import type { Snapshot } from "@/lib/types";

const PROGRESS_LABEL: Record<string, string> = {
  PENDING: "準備",
  RUNNING: "実行中",
  CACHE_HIT: "今日の候補",
  TOOL_STARTED: "ツール開始",
  HTTP_ATTEMPT: "外部取得",
  TOOL_COMPLETED: "取得完了",
  MODEL_SELECTED: "モデル選択",
  PLAN_APPLIED: "行程を作成",
};

export function PlanDetailContainer({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data, error, setData } = useSessionPoll(sessionId);
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState("カフェは喜んでた。展示は途中で疲れてた");
  const [traceOpen, setTraceOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    const snap = await api<Snapshot>(`/api/sessions/${sessionId}`);
    setData(snap);
  }

  async function post(path: string, body: unknown) {
    setActionError(null);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "error");
    }
  }

  const latestRun = data?.runs.at(-1);
  const generating = latestRun && ["PENDING", "RUNNING"].includes(latestRun.status);
  const cost = useMemo(() => {
    const runs = data?.runs ?? [];
    return {
      llm: runs.reduce((n, r) => n + (r.cost.llmJpy ?? 0), 0),
      api: runs.reduce((n, r) => n + (r.cost.apiJpy ?? 0), 0),
      hard: runs.reduce((n, r) => n + r.cost.hardCalls, 0),
      mundane: runs.reduce((n, r) => n + r.cost.mundaneCalls, 0),
      unaccounted: runs.reduce((n, r) => n + r.cost.unaccountedCalls, 0),
    };
  }, [data]);

  if (!data) {
    return <p className="text-ink-soft">{error ?? "読み込み中…"}</p>;
  }

  const pendingApproval = data.approvals.find((a) => a.status === "PENDING");
  const autoEvent = data.events.find((e) => e.type === "PLAN_AUTO_APPLIED");
  const changedIds = new Set(
    pendingApproval?.diff ? data.plan?.items.map((i) => i.id) : [],
  );

  return (
    <>
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {data.session.input.dateTokyo} {data.session.input.meet.name}
          </h1>
          <p className="text-sm text-ink-soft">
            {data.session.status} / 行程 v{data.plan?.version ?? "—"} / 検証 {data.plan?.validation.state ?? "—"}
          </p>
        </div>
        <ModeBanner runtime={data.runtime} mode={latestRun?.mode} overlays={data.overlays} />
        {actionError ? <p className="text-sm text-rose">{actionError}</p> : null}
        {generating ? (
          <Card className="bg-paper-deep">
            <p className="text-sm">行程を組み立てています。朝の一回取得があればそれを使い、都度探している演出ではありません。</p>
            <ol className="mt-2 space-y-1 text-sm">
              {data.events.slice(-6).map((e) => (
                <li key={e.eventId}>{PROGRESS_LABEL[e.type] ?? e.type}: {e.summary}</li>
              ))}
            </ol>
          </Card>
        ) : null}
        {autoEvent ? (
          <Card className="bg-moss-soft text-sm">自動適用しました: {autoEvent.summary}</Card>
        ) : null}
        {pendingApproval ? (
          <Card className="border-rose/30 bg-rose-soft">
            <h2 className="font-medium">変更を確認</h2>
            <p className="mt-1 text-sm">{pendingApproval.summary}</p>
            {pendingApproval.diff ? (
              <p className="text-sm text-ink-soft">
                差分: {pendingApproval.diff.summary}（v{pendingApproval.diff.fromVersion}→v{pendingApproval.diff.toVersion}）
              </p>
            ) : null}
            <p className="mt-1 text-xs text-ink-soft">承認するまで現行の行程は変わりません。</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void post(`/api/approvals/${pendingApproval.id}/decision`, { decision: "APPROVE" })}>
                この変更にする
              </Button>
              <Button variant="secondary" onClick={() => void post(`/api/approvals/${pendingApproval.id}/decision`, { decision: "REJECT" })}>
                却下
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardTitle>二人の希望</CardTitle>
            <ul className="mt-2 space-y-2 text-sm">
              {data.session.input.preferences.map((p) => (
                <li key={p.id}>
                  <span className="text-ink-soft">
                    {p.subject === "SELF"
                      ? "自分の希望"
                      : p.subject === "BOTH"
                        ? "二人とも"
                        : p.source === "OBSERVATION"
                          ? "相手（観察）"
                          : p.source === "PARTNER_STATEMENT_REPORTED"
                            ? "相手（伝聞）"
                            : "相手の希望"}{" "}
                    / {p.priority}
                  </span>
                  <div>{p.content}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle>残している仮定</CardTitle>
            <ul className="mt-2 list-disc pl-4 text-sm">
              {(data.plan?.assumptions ?? []).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle>Plan B</CardTitle>
            <ul className="mt-2 space-y-2 text-sm">
              {(data.plan?.planB ?? []).map((b) => (
                <li key={b.id}>
                  <div>{b.trigger}</div>
                  {b.isVerifiedAlternative && b.candidateSpotId ? (
                    <div className="text-ink-soft">代替: {data.spots[b.candidateSpotId]?.name ?? b.candidateSpotId}</div>
                  ) : (
                    <div className="text-ink-soft">{b.policy ?? "検証済み代替案ではない"}</div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">タイムライン</h2>
          {(data.plan?.items ?? []).map((item, i) => (
            <div key={item.id} className={cn(changedIds.has(item.id) && pendingApproval ? "ring-2 ring-rose/40 rounded-2xl" : "")}>
              <SpotCard
                item={item}
                spot={data.spots[item.spotId]}
                prefs={data.session.input.preferences}
                opening={data.plan?.openings?.find((o) => o.spotId === item.spotId)?.state}
                travelMinutes={data.plan?.legs[i]?.durationMinutes.value ?? null}
                onDone={() =>
                  void post(`/api/sessions/${data.session.id}/progress`, {
                    itemId: item.id,
                    progress: "DONE",
                    status: i === 0 ? "IN_PROGRESS" : undefined,
                  })
                }
              />
            </div>
          ))}
          {data.plan?.validation.issues.map((iss) => (
            <p key={iss.code + iss.message} className="text-sm">
              {iss.severity}: {iss.message}
            </p>
          ))}
          {data.plan?.memoryInfluences.length ? (
            <Card>
              <CardTitle>記憶の寄与</CardTitle>
              {data.plan.memoryInfluences.map((m) => (
                <p key={m.memoryId + m.detail} className="mt-1 text-sm">
                  {m.effect}: {m.detail}
                </p>
              ))}
            </Card>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void post(`/api/sessions/${data.session.id}/progress`, { confirm: true, status: "CONFIRMED" })}>
            このプランで決定
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void post(`/api/sessions/${data.session.id}/scenarios`, {
                kind: "WEATHER",
                overlay: { precipitationMm: 8 },
                from: data.session.input.dateTokyo + "T13:00:00+09:00",
                to: data.session.input.dateTokyo + "T18:00:00+09:00",
              })
            }
          >
            雨（シナリオ注入）
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void post(`/api/sessions/${data.session.id}/scenarios`, {
                kind: "TRAVEL_DELAY",
                overlay: { delayMinutes: 35 },
                spotId: data.plan?.items.at(-1)?.spotId,
              })
            }
          >
            遅れそう（シナリオ注入）
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void post(`/api/sessions/${data.session.id}/scenarios`, {
                kind: "SPOT_FULL",
                overlay: { full: true },
                spotId: data.plan?.items.find((i) => !i.locked)?.spotId,
              })
            }
          >
            満席（シナリオ注入）
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              const res = await api<{ text: string | null; blocked: boolean }>(
                `/api/sessions/${data.session.id}/message-draft`,
                { method: "POST", body: "{}" },
              );
              setDraft(res.blocked ? "出力検査で表示を止めました" : res.text);
            }}
          >
            共有文の下書き
          </Button>
          {latestRun ? (
            <Button
              variant="ghost"
              onClick={async () => {
                const res = await api<{ replayId: string }>(`/api/runs/${latestRun.id}/replay-export`, {
                  method: "POST",
                  body: "{}",
                });
                router.push(`/replay/${res.replayId}`);
              }}
            >
              REPLAYを保存
            </Button>
          ) : null}
          {latestRun ? (
            <Link href={`/runs/${latestRun.id}`} className="rounded-full px-4 py-2 text-sm text-ink-soft underline">
              実行ログ
            </Link>
          ) : null}
        </div>
        {draft ? <pre className="whitespace-pre-wrap rounded-2xl bg-paper-deep p-4 text-sm">{draft}</pre> : null}

        <Card>
          <CardTitle>振り返り</CardTitle>
          <textarea
            className="mt-3 w-full rounded-xl border border-line bg-paper p-3 text-sm"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            className="mt-3"
            onClick={async () => {
              await post(`/api/sessions/${data.session.id}/progress`, { status: "DONE" });
              await api(`/api/sessions/${data.session.id}/runs`, {
                method: "POST",
                body: JSON.stringify({ kind: "REFLECTION" }),
              });
              await reload();
            }}
          >
            確認質問をつくる
          </Button>
          {latestRun?.waitingQuestion ? (
            <div className="mt-4 space-y-2">
              <p>{latestRun.waitingQuestion.prompt}</p>
              {latestRun.waitingQuestion.options.map((opt) => (
                <button
                  key={opt}
                  className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm"
                  onClick={() =>
                    void post(`/api/runs/${latestRun.id}/answers`, {
                      questionId: latestRun.waitingQuestion!.id,
                      answer: opt,
                    })
                  }
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : null}
          {data.memoryCandidates.length ? (
            <p className="mt-3 text-sm text-ink-soft">
              候補が {data.memoryCandidates.length} 件。承認するまで有効な記憶にはなりません。
            </p>
          ) : null}
          {data.memories.some((m) => m.active) ? (
            <Button
              className="mt-3 w-full"
              onClick={async () => {
                const created = await api<{ sessionId: string }>(`/api/couples/${data.couple.id}/sessions`, {
                  method: "POST",
                  body: JSON.stringify((data.session as { input: Record<string, unknown> }).input),
                });
                await api(`/api/sessions/${created.sessionId}/runs`, {
                  method: "POST",
                  body: JSON.stringify({ kind: "NEXT_PLAN" }),
                });
                router.push(`/plan/${created.sessionId}`);
              }}
            >
              この記憶を使って次のプランをつくる
            </Button>
          ) : null}
        </Card>
      </div>

      <aside className="mt-6 lg:sticky lg:top-20 lg:mt-0 lg:self-start">
        <button
          type="button"
          className="mb-2 text-sm text-rose lg:hidden"
          onClick={() => setTraceOpen((v) => !v)}
        >
          {traceOpen ? "判断トレースを閉じる" : "判断トレースを開く"}
        </button>
        <Card className={cn("lg:block", traceOpen ? "block" : "hidden lg:block")}>
          <CardTitle>判断トレース</CardTitle>
          <ol className="mt-3 max-h-[70vh] space-y-2 overflow-auto text-sm">
            {data.events.map((e) => (
              <li key={e.eventId}>
                <span className="text-ink-soft">{e.type}</span> {e.summary}
                {e.actualModel ? <span className="text-ink-soft"> ({e.pool}/{e.actualModel})</span> : null}
              </li>
            ))}
          </ol>
        </Card>
      </aside>
    </div>
    <CostBadge llmJpy={cost.llm} apiJpy={cost.api} hard={cost.hard} mundane={cost.mundane} unaccounted={cost.unaccounted} />
    </>
  );
}
