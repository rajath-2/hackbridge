import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { HackBridgeState } from '../utils/state';
import { detectStack } from '../doctor/stack-fingerprint';
import { gitDiff } from '../utils/git';

export async function assembleContext(cwd: string, state: HackBridgeState, errorLog: string) {
  // 1. Cleaned stack trace
  const cleanedTrace = errorLog.replace(/\u001b\[[0-9;]*m/g, ''); // Strip ANSI

  // 2. Tech stack
  const stacks = await detectStack(cwd);
  const stackIdentity = stacks.map(s => `${s.name}${s.version ? ` (${s.version})` : ''}`).join(', ');

  // 3. Git diff (errored files only)
  const filePaths = Array.from(new Set(cleanedTrace.match(/[a-zA-Z0-9_/.-]+\.[a-z]+/g) || []));
  const projectFiles = filePaths.filter(f => !f.includes('node_modules') && fs.existsSync(path.join(cwd, f)));
  const diff = await gitDiff('HEAD~5..HEAD', projectFiles);

  // 4. Source files (snippets)
  const sourceSnippets: Record<string, string> = {};
  for (const f of projectFiles.slice(0, 5)) {
    const content = await fs.readFile(path.join(cwd, f), 'utf8');
    sourceSnippets[f] = content.split('\n').slice(0, 200).join('\n');
  }

  // 5. Track requirements
  let requirements = 'N/A';
  try {
    const res = await axios.get(`${state.api_base}/events/cli/${state.event_id}/requirements`, {
      params: { cli_token: state.cli_token }
    });
    requirements = JSON.stringify(res.data);
  } catch (e) {}

  return {
    stack_trace: cleanedTrace,
    stack_identity: stackIdentity,
    git_diff: diff,
    source_snippets: sourceSnippets,
    requirements
  };
}
