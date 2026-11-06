// The machine-wide list of projects the library shows: `<server home>/projects.json`.
import fs from "node:fs";
import path from "node:path";
import { randomId } from "./ids.js";
import { readJson, writeFileAtomic, writeJson } from "./paths.js";

export function listProjects(home) {
  const data = readJson(path.join(home, "projects.json"), { projects: [] });
  return (data.projects ?? []).filter((p) => p && typeof p.dir === "string" && fs.existsSync(p.dir));
}

export function registerProject(home, dir) {
  const resolved = path.resolve(dir);
  const file = path.join(home, "projects.json");
  const data = readJson(file, { projects: [] });
  const projects = data.projects ?? [];
  if (!projects.some((p) => p.dir === resolved)) {
    projects.push({ dir: resolved, name: path.basename(resolved), addedAt: new Date().toISOString() });
    writeJson(file, { schema: "designagent.projects/v1", projects });
  }
  return resolved;
}

export function unregisterProject(home, dir) {
  const resolved = path.resolve(dir);
  const file = path.join(home, "projects.json");
  const data = readJson(file, { projects: [] });
  const projects = (data.projects ?? []).filter((p) => p.dir !== resolved);
  writeJson(file, { schema: "designagent.projects/v1", projects });
}

/** The pairing key the app sends from other devices; created on first use, mode 0600. */
export function serverKey(home) {
  const file = path.join(home, "key");
  try {
    const key = fs.readFileSync(file, "utf8").trim();
    if (key.length >= 32) return key;
  } catch {}
  const key = randomId(40);
  writeFileAtomic(file, `${key}\n`);
  fs.chmodSync(file, 0o600);
  return key;
}

export const infoFile = (home) => path.join(home, "server-info.json");
export const readServerInfo = (home) => readJson(infoFile(home), null);
