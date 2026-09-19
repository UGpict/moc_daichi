import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const onCloudRun = Boolean(process.env.K_SERVICE);
const workerMode = (process.env.WORKER_MODE ?? (onCloudRun ? "http" : "poller")).toLowerCase();

const web = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

const children = [web];
if (workerMode === "poller") {
  children.push(
    spawn("npx", ["tsx", "src/worker/index.ts"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    }),
  );
}

function shutdown() {
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
