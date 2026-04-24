import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { CheckResult } from '../utils/render';
import { HackBridgeState } from '../utils/state';
import { gitRevCount, isGitRepo } from '../utils/git';
import { DetectedStack } from './stack-fingerprint';

export async function runPhase3(
  cwd: string,
  state: HackBridgeState | null,
  stacks: DetectedStack[]
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // -------------------------------------------------------------------------
  // 1. README check — always runs
  // -------------------------------------------------------------------------
  const readmePath = path.join(cwd, 'README.md');
  if (await fs.pathExists(readmePath)) {
    const readmeContent = await fs.readFile(readmePath, 'utf8');
    if (readmeContent.trim().length < 100) {
      results.push({ label: 'README.md', severity: 'WARN', message: 'README exists but is very short (< 100 chars)' });
    } else {
      results.push({ label: 'README.md', severity: 'OK', message: 'README exists and has content' });
    }
  } else {
    results.push({ label: 'README.md', severity: 'WARN', message: 'README.md is missing' });
  }

  // -------------------------------------------------------------------------
  // 2. package.json metadata — check root then detected node stack
  // -------------------------------------------------------------------------
  let pkgPath = path.join(cwd, 'package.json');
  if (!(await fs.pathExists(pkgPath))) {
    const nodeStack = stacks.find(s => ['nextjs', 'mern', 'node'].includes(s.name));
    if (nodeStack) pkgPath = path.join(nodeStack.path, 'package.json');
  }

  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJson(pkgPath);
      const issues: string[] = [];
      if (!pkg.name) issues.push('"name" missing');
      if (!pkg.description || pkg.description.toLowerCase().includes('todo')) issues.push('"description" missing or placeholder');

      if (issues.length > 0) {
        results.push({ label: 'package.json', severity: 'WARN', message: `${issues.join(', ')} — update before submission` });
      } else {
        results.push({ label: 'package.json', severity: 'OK', message: `Metadata verified (${pkg.name})` });
      }
    } catch {
      results.push({ label: 'package.json', severity: 'FAIL', message: 'Failed to parse package.json' });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Commit count — always runs
  // -------------------------------------------------------------------------
  const isRepo = await isGitRepo(cwd);
  if (!isRepo) {
    results.push({ label: 'Git', severity: 'FAIL', message: 'Not a git repository — run `git init`' });
  } else {
    const count = await gitRevCount();
    if (count === 0) {
      results.push({ label: 'Commits', severity: 'WARN', message: 'No commits yet — run `git commit`' });
    } else {
      results.push({ label: 'Commits', severity: 'OK', message: `${count} commit${count !== 1 ? 's' : ''} found` });
    }
  }

  // -------------------------------------------------------------------------
  // 4. Event requirements — only runs when state is available
  // -------------------------------------------------------------------------
  if (!state) {
    results.push({ label: 'Track', severity: 'WARN', message: 'Run `hackbridge init` to enable track compliance checks' });
    return results;
  }

  let requirements: { tracks?: string[]; min_commits?: number; required_docs?: string[] } = {};
  try {
    const res = await axios.get(`${state.api_base}/events/cli/${state.event_id}/requirements`, {
      params: { cli_token: state.cli_token },
      timeout: 5000,
    });
    requirements = res.data;
  } catch {
    results.push({ label: 'API', severity: 'WARN', message: 'Could not fetch event requirements (server offline or no internet)' });
    return results;
  }

  // Min commits requirement
  if (requirements.min_commits) {
    const count = await gitRevCount();
    if (count < requirements.min_commits) {
      results.push({
        label: 'Min Commits',
        severity: 'WARN',
        message: `Event requires ≥${requirements.min_commits} commits, you have ${count}`,
      });
    } else {
      results.push({
        label: 'Min Commits',
        severity: 'OK',
        message: `Commit count (${count}) meets requirement (${requirements.min_commits})`,
      });
    }
  }

  // Required docs
  for (const doc of requirements.required_docs || []) {
    const exists = await fs.pathExists(path.join(cwd, doc));
    results.push({
      label: doc,
      severity: exists ? 'OK' : 'WARN',
      message: exists ? `${doc} present` : `${doc} missing — required for this track`,
    });
  }

  // Track compliance
  const tracks = requirements.tracks || [];
  if (tracks.includes('AI/ML')) {
    const hasAI = stacks.some(s => s.name === 'fastapi' || s.name === 'nextjs');
    if (!hasAI) {
      results.push({ label: 'Track:AI/ML', severity: 'WARN', message: 'No AI-compatible stack detected for AI/ML track' });
    } else {
      results.push({ label: 'Track:AI/ML', severity: 'OK', message: 'AI-compatible stack detected' });
    }
  }

  return results;
}
