// Where things live: the per-project artifact store and the machine-wide server state.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const STORE_DIR = ".designagent";
export const ARTIFACTS_DIR = "artifacts";
export const DEFAULT_PORTS = [27419, 27420, 27421];

/** The machine-wide server home: projects.json, key, server-info.json, server.log. */
export function serverHome(env = process.env) {
  return env.DESIGNAGENT_SERVER_HOME || path.join(os.homedir(), STORE_DIR, "server");
}

/** Ports the server tries in order (DESIGNAGENT_ARTIFACTS_PORTS="1,2,3"). */
export function candidatePorts(env = process.env) {
  const raw = env.DESIGNAGENT_ARTIFACTS_PORTS;
  if (!raw) return DEFAULT_PORTS;
  const ports = raw
    .split(",")
    .map((p) => Number.parseInt(p.trim(), 10))
    .filter((p) => Number.isInteger(p) && p >= 0 && p < 65536);
  return ports.length ? ports : DEFAULT_PORTS;
}

export function artifactsRoot(projectDir) {
  return path.join(projectDir, STORE_DIR, ARTIFACTS_DIR);
}

/**
 * The project a directory belongs to: the nearest ancestor with its own store, else the
 * enclosing git repository's root, else the directory itself.
 */
export function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, STORE_DIR, ARTIFACTS_DIR))) return dir;
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
    dir = parent;
  }
}

/** Writes a file atomically: a temporary sibling, then a rename. */
export function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`${file}: ${error.message}`);
  }
}

export function writeJson(file, value) {
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}
