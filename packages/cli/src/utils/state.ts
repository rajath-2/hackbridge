import * as fs from 'fs-extra';
import * as path from 'path';

export interface HackBridgeState {
  team_id: string;
  event_id: string;
  team_code: string;
  event_code: string;
  cli_token: string;
  api_base: string;
  initialized_at: string;
}

/**
 * Walk up the directory tree from `startDir` to find the nearest
 * `.hackbridge/state.json`, just like git finds `.git`.
 */
function findStateFile(startDir: string): string | null {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, '.hackbridge', 'state.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null; // reached filesystem root
    current = parent;
  }
}

export async function loadState(): Promise<HackBridgeState> {
  const statePath = findStateFile(process.cwd());
  if (!statePath) {
    throw new Error('Project not initialized. Run `hackbridge init <cli_token>` first.');
  }
  return await fs.readJson(statePath);
}

export async function loadStateOptional(): Promise<HackBridgeState | null> {
  try {
    return await loadState();
  } catch {
    return null;
  }
}

export async function saveState(partial: Partial<HackBridgeState>): Promise<void> {
  const statePath =
    findStateFile(process.cwd()) ??
    path.join(process.cwd(), '.hackbridge', 'state.json');

  let current: Partial<HackBridgeState> = {};
  if (await fs.pathExists(statePath)) {
    current = await fs.readJson(statePath);
  } else {
    await fs.ensureDir(path.dirname(statePath));
  }

  const newState = { ...current, ...partial };
  await fs.writeJson(statePath, newState, { spaces: 2 });
}

export function getConfigPath(): string {
  return findStateFile(process.cwd()) ?? path.join(process.cwd(), '.hackbridge', 'state.json');
}
