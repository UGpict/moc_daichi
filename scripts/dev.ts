import { spawn, type ChildProcess } from "node:child_process";
import { getEnv } from "../src/config/env";
import { applyEmulatorEnv } from "../src/server/auth/emulatorGuard";

async function prepare() {
  const env = getEnv();
  if (env.profile === "EMULATOR") {
    applyEmulatorEnv();
    const { ensureEmulator } = await import("./ensure-emulator");
    await ensureEmulator();
  }
}

function run(name: string, args: string[]) {
  const child = spawn(name, args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
  child.on("exit", (code) => {
    if (code) process.exit(code ?? 1);
  });
  return child;
}

const children: ChildProcess[] = [];

function shutdown() {
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void prepare().then(() => {
  children.push(run("npx", ["next", "dev", "-p", "3000"]));
  children.push(run("npx", ["tsx", "src/worker/index.ts"]));
});
