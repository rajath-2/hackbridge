import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { exec } from '../utils/exec';
import { CheckResult } from '../utils/render';
import { DetectedStack } from './stack-fingerprint';

export async function runPhase2(cwd: string, stacks: DetectedStack[]): Promise<CheckResult[]> {
  if (stacks.length === 0) {
    return [{ label: 'Stack', severity: 'WARN', message: 'No recognizable tech stack detected in this directory' }];
  }

  const results: CheckResult[] = [];

  for (const stack of stacks) {
    switch (stack.name) {
      case 'nextjs':
        results.push(...(await checkNextjs(stack.path)));
        break;
      case 'fastapi':
        results.push(...(await checkFastAPI(stack.path, cwd)));
        break;
      case 'prisma':
        results.push(...(await checkPrisma(stack.path)));
        break;
      case 'supabase':
        results.push(...(await checkSupabase(stack.path, cwd)));
        break;
      case 'node':
        results.push(...(await checkNodeProject(stack.path)));
        break;
      case 'mern':
        results.push(...(await checkNodeProject(stack.path)));
        break;
    }
  }

  results.push(...(await checkInfrastructure(cwd)));

  return results;
}

// ---------------------------------------------------------------------------
// Next.js
// ---------------------------------------------------------------------------
async function checkNextjs(stackPath: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const configExists =
    (await fs.pathExists(path.join(stackPath, 'next.config.ts'))) ||
    (await fs.pathExists(path.join(stackPath, 'next.config.js'))) ||
    (await fs.pathExists(path.join(stackPath, 'next.config.mjs')));

  if (!configExists) {
    results.push({ label: 'Next.js', severity: 'FAIL', message: 'next.config file missing' });
  }

  const appDir =
    (await fs.pathExists(path.join(stackPath, 'app'))) ||
    (await fs.pathExists(path.join(stackPath, 'src', 'app')));
  const pagesDir =
    (await fs.pathExists(path.join(stackPath, 'pages'))) ||
    (await fs.pathExists(path.join(stackPath, 'src', 'pages')));

  if (!appDir && !pagesDir) {
    results.push({ label: 'Next.js', severity: 'FAIL', message: 'Neither /app nor /pages directory found' });
  }

  if (results.length === 0) {
    results.push({ label: 'Next.js', severity: 'OK', message: 'Project structure looks correct' });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Generic Node project
// ---------------------------------------------------------------------------
async function checkNodeProject(stackPath: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const nodeModules = path.join(stackPath, 'node_modules');
  const pkgLock = path.join(stackPath, 'package-lock.json');
  const yarnLock = path.join(stackPath, 'yarn.lock');
  const pnpmLock = path.join(stackPath, 'pnpm-lock.yaml');

  const hasLockfile =
    (await fs.pathExists(pkgLock)) ||
    (await fs.pathExists(yarnLock)) ||
    (await fs.pathExists(pnpmLock));

  if (!hasLockfile) {
    results.push({
      label: `Node (${path.basename(stackPath)})`,
      severity: 'WARN',
      message: 'No lockfile found — run npm install / yarn / pnpm install',
    });
  } else if (!(await fs.pathExists(nodeModules))) {
    results.push({
      label: `Node (${path.basename(stackPath)})`,
      severity: 'WARN',
      message: 'node_modules missing — run npm install',
    });
  } else {
    results.push({
      label: `Node (${path.basename(stackPath)})`,
      severity: 'OK',
      message: 'Dependencies installed',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// FastAPI
// ---------------------------------------------------------------------------
async function checkFastAPI(stackPath: string, rootPath: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const label = `FastAPI (${path.basename(stackPath)})`;

  // 1. Entry point check — independent of venv
  const mainPath = path.join(stackPath, 'main.py');
  const appPath = path.join(stackPath, 'app.py');
  const hasEntry = (await fs.pathExists(mainPath)) || (await fs.pathExists(appPath));

  if (!hasEntry) {
    results.push({ label, severity: 'FAIL', message: 'No main.py or app.py entry point found' });
    return results;
  }

  // 2. Venv detection (check stack dir, then root)
  let venvDir = path.join(stackPath, '.venv');
  if (!(await fs.pathExists(venvDir))) {
    venvDir = path.join(rootPath, '.venv');
  }
  const hasVenv = (await fs.pathExists(venvDir)) || !!process.env.VIRTUAL_ENV;

  if (!hasVenv) {
    results.push({ label, severity: 'WARN', message: 'No virtual environment found (.venv). Run `python -m venv .venv`' });
    return results;
  }

  const pythonExec = process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

  // 3. Dependency integrity
  const pipCheck = await exec(`"${pythonExec}" -m pip check`, { timeoutMs: 15000 });
  if (pipCheck.exitCode !== 0) {
    results.push({ label: `${label}:Deps`, severity: 'WARN', message: 'Dependency conflicts via pip check — run pip install -r requirements.txt' });
  }

  // 4. Import check
  const entryFile = (await fs.pathExists(mainPath)) ? 'main' : 'app';
  const importCheck = await exec(`"${pythonExec}" -c "import ${entryFile}"`, { cwd: stackPath, timeoutMs: 10000 });
  if (importCheck.exitCode !== 0) {
    const errLine = importCheck.stderr.split('\n').filter(Boolean).pop() || importCheck.stderr;
    results.push({ label: `${label}:Import`, severity: 'FAIL', message: `${entryFile}.py import failed: ${errLine}` });
  }

  if (!results.some(r => r.severity === 'FAIL' || r.severity === 'WARN')) {
    results.push({ label, severity: 'OK', message: 'Venv, entry point, and imports verified' });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------
async function checkPrisma(stackPath: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const schemaExists = await fs.pathExists(path.join(stackPath, 'prisma', 'schema.prisma'));

  if (!schemaExists) {
    results.push({ label: 'Prisma', severity: 'FAIL', message: 'prisma/schema.prisma missing' });
    return results;
  }

  const clientExists = await fs.pathExists(path.join(stackPath, 'node_modules', '.prisma', 'client'));
  if (!clientExists) {
    results.push({ label: 'Prisma', severity: 'WARN', message: 'Client not generated — run `npx prisma generate`' });
  } else {
    results.push({ label: 'Prisma', severity: 'OK', message: 'Schema and client verified' });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Supabase — live credential check
// ---------------------------------------------------------------------------
async function checkSupabase(stackPath: string, rootPath: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Try stack path first, then fallback to root
  let envPath = path.join(stackPath, '.env');
  if (!(await fs.pathExists(envPath))) {
    envPath = path.join(rootPath, '.env');
  }
  if (!(await fs.pathExists(envPath))) {
    return [{ label: 'Supabase', severity: 'WARN', message: '.env not found — cannot verify Supabase credentials' }];
  }

  const content = await fs.readFile(envPath, 'utf8');
  const getEnvVar = (name: string): string | null => {
    const match = content.match(new RegExp(`(?:^|\\n)\\s*${name}\\s*=\\s*['\"]?([^'\"\\n\\s#]+)['\"]?`));
    return match ? match[1] : null;
  };

  // Support both NEXT_PUBLIC_ and raw SUPABASE_ prefixes
  const url =
    getEnvVar('SUPABASE_URL') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
    getEnvVar('VITE_SUPABASE_URL');
  const key =
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    getEnvVar('VITE_SUPABASE_ANON_KEY');

  if (!url || !key) {
    results.push({ label: 'Supabase', severity: 'FAIL', message: 'SUPABASE_URL or SUPABASE_ANON_KEY missing from .env' });
    return results;
  }

  try {
    const baseUrl = url.endsWith('/') ? url : `${url}/`;
    const res = await axios.get(`${baseUrl}rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      timeout: 6000,
    });
    if (res.status === 200) {
      results.push({ label: 'Supabase', severity: 'OK', message: 'Credentials verified and REST API is reachable' });
    }
  } catch (e: any) {
    if (e.response?.status === 401) {
      results.push({
        label: 'Supabase',
        severity: 'FAIL',
        message: 'Unauthorized (401) — SUPABASE_ANON_KEY may be wrong or expired',
      });
    } else if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      results.push({ label: 'Supabase', severity: 'FAIL', message: 'Connection timed out — check SUPABASE_URL is correct' });
    } else if (e.response) {
      results.push({ label: 'Supabase', severity: 'FAIL', message: `API returned ${e.response.status} — check credentials` });
    } else {
      results.push({ label: 'Supabase', severity: 'FAIL', message: `Unreachable: ${e.message}` });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Infrastructure reachability
// ---------------------------------------------------------------------------
async function checkInfrastructure(cwd: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  
  const endpoints = [
    { label: 'GitHub API', url: 'https://api.github.com' },
    { label: 'Groq API', url: 'https://api.groq.com/openai/v1/models' }
  ];

  for (const ep of endpoints) {
    try {
      await axios.get(ep.url, { timeout: 3000 });
      results.push({ label: ep.label, severity: 'OK', message: 'Reachable' });
    } catch (e: any) {
      // 401/404 are actually good signs (reachable but needs auth)
      if (e.response || (e.code !== 'ECONNABORTED' && e.code !== 'ENOTFOUND')) {
        results.push({ label: ep.label, severity: 'OK', message: 'Reachable' });
      } else {
        results.push({ label: ep.label, severity: 'WARN', message: `Possibly unreachable: ${e.message}` });
      }
    }
  }

  return results;
}
