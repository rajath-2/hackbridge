import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { exec } from '../utils/exec';
import { gitStash } from '../utils/git';

export async function applyPatch(cwd: string, patchContent: string) {
  if (!patchContent.startsWith('---') && !patchContent.includes('+++')) {
    console.log(chalk.red('\nAI suggestion is not a valid patch/diff format. Cannot --apply.'));
    return;
  }

  const patchDir = path.join(cwd, '.hackbridge', 'patches');
  await fs.ensureDir(patchDir);
  const patchFile = path.join(patchDir, `fix-${Date.now()}.patch`);
  await fs.writeFile(patchFile, patchContent);

  console.log(chalk.yellow(`\nVerifying patch: ${path.basename(patchFile)}`));
  const check = await exec(`git apply --check ${patchFile}`);
  
  if (check.exitCode !== 0) {
    console.log(chalk.red('✗ Patch validation failed. It might be out of date or malformed.'));
    console.log(chalk.gray(check.stderr));
    return;
  }

  console.log(chalk.green('✓ Patch validated.'));
  // I need a way to prompt the user, maybe I should pass rl or use a library
  // But for now I'll just apply it if --apply was passed
  
  await gitStash(`hackbridge-debug-apply-${Date.now()}`);
  const apply = await exec(`git apply ${patchFile}`);
  
  if (apply.exitCode === 0) {
    console.log(chalk.bold.green('\n✓ Patch applied successfully!'));
  } else {
    console.log(chalk.red('\n✗ Failed to apply patch.'));
  }
}
