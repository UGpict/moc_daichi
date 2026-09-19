import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";

export const EMULATOR_PROJECT_ID = "futari-log-dev";
export const DEFAULT_FIRESTORE_EMU = "127.0.0.1:8080";
export const DEFAULT_AUTH_EMU = "127.0.0.1:9099";

export type EmulatorHosts = {
  firestore: string;
  auth: string;
};

export function emulatorHosts(): EmulatorHosts {
  return {
    firestore: process.env.FIRESTORE_EMULATOR_HOST?.trim() || DEFAULT_FIRESTORE_EMU,
    auth: process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim() || DEFAULT_AUTH_EMU,
  };
}

/** Emulator プロファイルでは接続先と projectId を揃える。本番用 ADC は使わない。 */
export function applyEmulatorEnv(): EmulatorHosts {
  const hosts = emulatorHosts();
  process.env.APP_RUNTIME = "EMULATOR";
  process.env.FIRESTORE_EMULATOR_HOST = hosts.firestore;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = hosts.auth;
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST = hosts.auth;
  process.env.FIREBASE_PROJECT_ID = EMULATOR_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = EMULATOR_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||= "fake-api-key-for-emulator";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||= "localhost";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||= "emu-app";
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return hosts;
}

function parseHost(raw: string): { host: string; port: number } {
  const trimmed = raw.replace(/^https?:\/\//, "");
  const [host, portText] = trimmed.split(":");
  return { host: host || "127.0.0.1", port: Number(portText) || 0 };
}

export function probePortSync(raw: string): boolean {
  const { host, port } = parseHost(raw);
  if (!port) return false;
  const result = spawnSync("bash", ["-c", `echo >/dev/tcp/${host}/${port}`], {
    timeout: 800,
    stdio: "ignore",
  });
  return result.status === 0;
}

export function probePort(raw: string, timeoutMs = 800): Promise<boolean> {
  const { host, port } = parseHost(raw);
  if (!port) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function emulatorStatus(hosts = emulatorHosts()): Promise<{
  firestore: boolean;
  auth: boolean;
  ready: boolean;
  firestoreHost: string;
  authHost: string;
  projectId: string;
}> {
  const [firestore, auth] = await Promise.all([probePort(hosts.firestore), probePort(hosts.auth)]);
  return {
    firestore,
    auth,
    ready: firestore && auth,
    firestoreHost: hosts.firestore,
    authHost: hosts.auth,
    projectId: EMULATOR_PROJECT_ID,
  };
}
