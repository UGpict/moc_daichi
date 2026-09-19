import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diagnosePersist, diagnosePersistSync } from "../src/server/repositories/persistDiagnose";

async function main() {
  const sync = diagnosePersistSync();
  const full = await diagnosePersist();
  const out = {
    at: new Date().toISOString(),
    sync,
    probe: full,
  };
  mkdirSync("docs/reports", { recursive: true });
  const file = join("docs/reports", "persist-diagnosis.json");
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

void main();
