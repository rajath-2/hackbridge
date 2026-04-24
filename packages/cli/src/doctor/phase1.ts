import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { exec } from '../utils/exec';
import { CheckResult } from '../utils/render';
import { DetectedStack } from './stack-fingerprint';

export async function runPhase1(cwd: string, stacks: DetectedStack[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Run all checks in parallel for speed
  const [tools, ports, envs, health] = await Promise.all([
    checkToolPresence(stacks),
    checkPortConflicts(cwd),
    checkEnvIntegrity(cwd, stacks),
    checkSystemHealth(),
  ]);

  results.push(...tools, ...ports, ...envs, ...health);
  return results;
}

// ---------------------------------------------------------------------------
// 1.1 Tool Presence
// ---------------------------------------------------------------------------
async function checkToolPresence(stacks: DetectedStack[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const hasFastapi = stacks.some(s => s.name === 'fastapi');

  // Always check: git, node
  const coreTools: Array<{ name: string; cmd: string }> = [
    { name: 'git', cmd: 'git --version' },
    { name: 'node', cmd: 'node --version' },
  ];

  if (hasFastapi) {
    coreTools.push({
      name: 'python',
      cmd: process.platform === 'win32'
        ? 'python --version'
        : 'python3 --version || python --version',
    });
  }

  for (const tool of coreTools) {
    const res = await exec(tool.cmd);
    if (res.exitCode === 0) {
      const version = res.stdout.split('\n')[0].trim();
      results.push({ label: tool.name, severity: 'OK', message: `${version} detected` });
    } else {
      results.push({ label: tool.name, severity: 'FAIL', message: `${tool.name} not found in PATH` });
    }
  }

  // Docker: optional WARN only (not doubled in system health)
  const dockerBin = await exec('docker --version');
  if (dockerBin.exitCode !== 0) {
    results.push({ label: 'docker', severity: 'WARN', message: 'Docker not found (optional unless using containers)' });
  } else {
    // Docker binary present — check daemon separately
    const dockerDaemon = await exec('docker info');
    if (dockerDaemon.exitCode !== 0) {
      results.push({ label: 'docker', severity: 'WARN', message: 'Docker installed but daemon is not running' });
    } else {
      results.push({ label: 'docker', severity: 'OK', message: `${dockerBin.stdout.split('\n')[0].trim()} (daemon running)` });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 1.2 Port Conflict Detection
// ---------------------------------------------------------------------------
const BASELINE_PORTS = [3000, 5000, 8000, 8080, 4000, 5432, 27017, 6379];

async function checkPortConflicts(cwd: string): Promise<CheckResult[]> {
  const envPorts = await scanEnvForPorts(cwd);
  const allPorts = Array.from(new Set([...BASELINE_PORTS, ...envPorts]));

  const occupied = await getOccupiedPorts();
  const conflicts: CheckResult[] = [];

  for (const port of allPorts) {
    if (occupied.has(port)) {
      const isEnvPort = envPorts.includes(port);
      conflicts.push({
        label: `Port ${port}`,
        severity: isEnvPort ? 'FAIL' : 'WARN',
        message: `Port ${port} is in use${isEnvPort ? ' (required by .env)' : ' (common port)'}`,
      });
    }
  }

  if (conflicts.length === 0) {
    return [{ label: 'Ports', severity: 'OK', message: 'No critical port conflicts detected' }];
  }
  return conflicts;
}

async function scanEnvForPorts(cwd: string): Promise<number[]> {
  const ports: number[] = [];
  // Check root + common app subdirectories
  const searchDirs = [cwd];
  try {
    const entries = await fs.readdir(cwd, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        searchDirs.push(path.join(cwd, e.name));
      }
    }
  } catch {}

  for (const dir of searchDirs) {
    for (const file of ['.env', '.env.example', '.env.local']) {
      const p = path.join(dir, file);
      if (!(await fs.pathExists(p))) continue;
      const content = await fs.readFile(p, 'utf8');
      // Match PORT=NNNN or URL patterns containing :NNNN
      const urlPortMatches = content.match(/(?:DATABASE_URL|REDIS_URL|MONGO_URI|.*_URL)=[^=\n]*:(\d{4,5})/g) || [];
      for (const m of urlPortMatches) {
        const port = parseInt(m.split(':').pop() || '');
        if (port) ports.push(port);
      }
      const directMatches = content.match(/(?:^|\n)(?:PORT|.*_PORT)\s*=\s*(\d+)/g) || [];
      for (const m of directMatches) {
        const port = parseInt(m.split('=').pop()?.trim() || '');
        if (port) ports.push(port);
      }
    }
  }
  return Array.from(new Set(ports));
}

async function getOccupiedPorts(): Promise<Set<number>> {
  const ports = new Set<number>();
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'netstat -ano' : 'ss -tlnp 2>/dev/null || lsof -i -P -n | grep LISTEN';
  const res = await exec(cmd);
  const lines = res.stdout.split('\n');

  if (isWin) {
    for (const line of lines) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      // Local address is parts[1] e.g. 0.0.0.0:8000 or [::]:8000
      const addr = parts[1] || '';
      const portStr = addr.includes(':') ? addr.split(':').pop() : '';
      const port = parseInt(portStr || '');
      if (port && port > 0 && port < 65536) ports.add(port);
    }
  } else {
    for (const line of lines) {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        const port = parseInt(match[1]);
        if (port > 0 && port < 65536) ports.add(port);
      }
    }
  }
  return ports;
}

// ---------------------------------------------------------------------------
// 1.3 .env File Integrity — check root + all detected stack paths
// ---------------------------------------------------------------------------
async function checkEnvIntegrity(cwd: string, stacks: DetectedStack[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  // Collect all unique directories that might have a .env
  const dirsToCheck = Array.from(
    new Set([cwd, ...stacks.map(s => s.path)])
  );

  for (const dir of dirsToCheck) {
    const envPath = path.join(dir, '.env');
    const examplePath = path.join(dir, '.env.example');
    const label = dir === cwd ? '.env' : `.env (${path.relative(cwd, dir)})`;

    if (!(await fs.pathExists(envPath))) {
      // Only FAIL if there's an .env.example that expects one
      if (await fs.pathExists(examplePath)) {
        results.push({ label, severity: 'FAIL', message: `.env missing (has .env.example in ${path.relative(cwd, dir) || '.'})` });
      }
      continue;
    }

    if (await fs.pathExists(examplePath)) {
      const envContent = await fs.readFile(envPath, 'utf8');
      const exampleContent = await fs.readFile(examplePath, 'utf8');
      const getKeys = (c: string) =>
        c.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'))
          .map(l => l.split('=')[0].trim());

      const envKeys = new Set(getKeys(envContent));
      const missingKeys = getKeys(exampleContent).filter(k => k && !envKeys.has(k));

      if (missingKeys.length > 0) {
        for (const key of missingKeys) {
          results.push({ label: `.env:${key}`, severity: 'FAIL', message: `Key "${key}" missing from ${path.relative(cwd, envPath) || '.env'}` });
        }
      } else {
        results.push({ label, severity: 'OK', message: `.env synchronized with .env.example` });
      }
    } else {
      results.push({ label, severity: 'OK', message: `.env present` });
    }
  }

  if (results.length === 0) {
    results.push({ label: '.env', severity: 'WARN', message: 'No .env files found in project' });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 1.4 System Health (git identity only — docker moved to tool presence)
// ---------------------------------------------------------------------------
async function checkSystemHealth(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Git identity
  const [nameRes, emailRes] = await Promise.all([
    exec('git config user.name'),
    exec('git config user.email'),
  ]);
  const hasName = nameRes.exitCode === 0 && nameRes.stdout.trim().length > 0;
  const hasEmail = emailRes.exitCode === 0 && emailRes.stdout.trim().length > 0;

  if (!hasName || !hasEmail) {
    results.push({
      label: 'Git Identity',
      severity: 'FAIL',
      message: `git config ${!hasName ? 'user.name' : ''}${!hasName && !hasEmail ? ' and ' : ''}${!hasEmail ? 'user.email' : ''} not set`,
    });
  } else {
    results.push({
      label: 'Git Identity',
      severity: 'OK',
      message: `${nameRes.stdout.trim()} <${emailRes.stdout.trim()}>`,
    });
  }

  // Disk space (warn if < 500 MB free)
  const isWin = process.platform === 'win32';
  const diskCmd = isWin
    ? 'wmic logicaldisk get freespace,caption'
    : 'df -k . | tail -1';
  const diskRes = await exec(diskCmd);

  let freeMb = Infinity;
  if (isWin) {
    const lines = diskRes.stdout.split('\n').filter(l => l.trim());
    // First data line after header: "C:    12345678"
    const dataLine = lines[1] || '';
    const parts = dataLine.trim().split(/\s+/);
    const freeBytes = parseInt(parts[1] || '0');
    freeMb = isNaN(freeBytes) ? Infinity : Math.floor(freeBytes / (1024 * 1024));
  } else {
    const parts = diskRes.stdout.trim().split(/\s+/);
    const freeKb = parseInt(parts[3] || '0');
    freeMb = isNaN(freeKb) ? Infinity : Math.floor(freeKb / 1024);
  }

  if (freeMb < 500) {
    results.push({ label: 'Disk Space', severity: 'WARN', message: `Only ${freeMb} MB free on disk` });
  } else {
    results.push({ label: 'Disk Space', severity: 'OK', message: `${freeMb === Infinity ? '>1000' : freeMb} MB free` });
  }

  return results;
}
