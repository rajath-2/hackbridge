import chalk from 'chalk';
import { gitLog, gitCheckout } from '../utils/git';
import { exec } from '../utils/exec';
import * as fs from 'fs-extra';
import * as path from 'path';

export async function runBisect(cwd: string, n: number, errorPattern: string) {
  console.log(chalk.bold.blue(`\nStarting git bisect simulation for last ${n} commits...`));
  
  const commits = await gitLog(n);
  if (commits.length === 0) {
    console.log(chalk.red('No commits found to bisect.'));
    return;
  }

  // Find test command
  let testCmd = 'npm run dev';
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = fs.readJsonSync(pkgPath);
    if (pkg.scripts?.test) testCmd = 'npm test';
    else if (pkg.scripts?.dev) testCmd = 'npm run dev';
  }

  console.log(chalk.gray(`Using test command: ${testCmd}`));

  let culprit = null;
  const originalRef = 'HEAD';

  try {
    for (const commit of commits) {
      console.log(chalk.cyan(`Checking ${commit.hash.substring(0, 7)}: ${commit.message}`));
      await gitCheckout(commit.hash);
      
      const res = await exec(testCmd, { timeoutMs: 10000 });
      const foundError = res.stderr.includes(errorPattern) || res.stdout.includes(errorPattern);
      
      if (!foundError) {
        console.log(chalk.green(`✓ Stable at ${commit.hash.substring(0, 7)}`));
        // The one before this (more recent) was the culprit
        const idx = commits.indexOf(commit);
        if (idx > 0) culprit = commits[idx - 1];
        break;
      }
    }
  } finally {
    await gitCheckout('-'); // Restore
  }

  if (culprit) {
    console.log(chalk.bold.red(`\nPossible culprit commit found: ${culprit.hash.substring(0, 7)}`));
    console.log(chalk.red(`Message: ${culprit.message}`));
  } else {
    console.log(chalk.yellow('\nCould not isolate a specific culprit commit.'));
  }

  return culprit;
}
