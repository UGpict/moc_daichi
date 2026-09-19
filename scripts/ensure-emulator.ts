import { spawn } from "node:child_process";
import { applyEmulatorEnv, emulatorStatus, EMULATOR_PROJECT_ID } from "../src/server/auth/emulatorGuard";

const SESSION = "firebase-emu";

function tmux(args: string[]) {
  return spawn("tmux", ["-f", "/exec-daemon/tmux.portal.conf", ...args], {
    stdio: "ignore",
    detached: true,
  });
}

function hasTmuxSession(): boolean {
  const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
  const r = spawnSync("tmux", ["-f", "/exec-daemon/tmux.portal.conf", "has-session", "-t", `=${SESSION}`], {
    stdio: "ignore",
  });
  return r.status === 0;
}

async function waitReady(timeoutMs = 90_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await emulatorStatus();
    if (status.ready) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Firebase Emulator が起動しない。本番へは接続しない");
}

export async function ensureEmulator(): Promise<void> {
  applyEmulatorEnv();
  const already = await emulatorStatus();
  if (already.ready) return;
  const cwd = process.cwd();
  const cmd = `npx firebase emulators:start --only auth,firestore --project ${EMULATOR_PROJECT_ID}`;
  if (hasTmuxSession()) {
    await waitReady();
    return;
  }
  try {
    const created = spawn(
      "tmux",
      ["-f", "/exec-daemon/tmux.portal.conf", "new-session", "-d", "-s", SESSION, "-c", cwd, "--", "bash", "-lc", cmd],
      { stdio: "ignore", detached: true },
    );
    created.unref();
  } catch {
    const child = spawn("bash", ["-lc", cmd], { cwd, stdio: "ignore", detached: true });
    child.unref();
    void tmux;
  }
  await waitReady();
}

if (process.argv[1] && process.argv[1].endsWith("ensure-emulator.ts")) {
  ensureEmulator()
    .then(async () => {
      const status = await emulatorStatus();
      console.log(JSON.stringify({ ok: true, ...status }));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
