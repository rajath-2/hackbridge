import { exec } from './exec';

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export async function gitDiff(range: string, files?: string[]): Promise<string> {
  const fileArgs = files ? `-- ${files.join(' ')}` : '';
  const result = await exec(`git diff ${range} ${fileArgs}`);
  return result.stdout;
}

export async function gitLog(n: number): Promise<GitCommit[]> {
  const result = await exec(`git log -n ${n} --pretty=format:"%H|%s|%an|%ad"`);
  if (result.exitCode !== 0) return [];
  
  return result.stdout.split('\n').map(line => {
    const [hash, message, author, date] = line.split('|');
    return { hash, message, author, date };
  });
}

export async function gitStash(label: string): Promise<void> {
  await exec(`git stash push -m "${label}"`);
}

export async function gitCheckout(ref: string): Promise<void> {
  await exec(`git checkout ${ref}`);
}

export async function gitRevCount(): Promise<number> {
  const result = await exec('git rev-list --count HEAD');
  return parseInt(result.stdout) || 0;
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await exec('git rev-parse --is-inside-work-tree', { cwd });
  return result.exitCode === 0;
}
