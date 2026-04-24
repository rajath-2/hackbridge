import * as readline from 'readline';
import axios from 'axios';
import chalk from 'chalk';
import { HackBridgeState } from '../utils/state';
import { CheckResult, printSeparator } from '../utils/render';
import { exec } from '../utils/exec';

export async function runFixFlow(state: HackBridgeState, fails: CheckResult[]) {
  if (fails.length === 0) {
    console.log(chalk.green('\n✓ No FAIL items to fix!'));
    return;
  }

  console.log(chalk.bold.blue(`\nStarting guided AI fix flow for ${fails.length} item(s)...`));
  console.log(chalk.gray('Type Y to apply a fix, N to skip, or Q to quit.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  let stashedAlready = false;

  for (const fail of fails) {
    printSeparator();
    console.log(chalk.bold(`Fixing: ${fail.label}`));
    console.log(chalk.red(`  Issue: ${fail.message}`));

    let fixCommands: Array<{ command: string; description: string }> = [];

    try {
      const res = await axios.post(
        `${state.api_base}/teams/${state.team_id}/cli/groq-relay`,
        {
          cli_token: state.cli_token,
          team_code: state.team_code,
          prompt_type: 'fix',
          system_prompt:
            'You are a developer environment repair tool. Return ONLY valid JSON with no markdown fences: { "fix_commands": [{ "command": "string", "description": "string" }] }',
          user_prompt: `FAIL: ${fail.label} — ${fail.message}`,
        },
        { timeout: 15000 }
      );

      const parsed = JSON.parse(res.data.content);
      fixCommands = parsed.fix_commands || [];
    } catch (e: any) {
      console.log(chalk.red(`  Could not get AI suggestion: ${e.message}`));
      continue;
    }

    if (fixCommands.length === 0) {
      console.log(chalk.yellow('  AI returned no fix commands for this issue.'));
      continue;
    }

    for (const cmd of fixCommands) {
      console.log(chalk.yellow(`\n  Suggested: ${cmd.description}`));
      console.log(chalk.cyan(`  Command:   ${cmd.command}`));

      const answer = await ask('  Apply? [Y/n/q]: ');
      if (answer.toLowerCase() === 'q') {
        rl.close();
        console.log(chalk.bold.blue('\nFix flow aborted.'));
        return;
      }

      if (answer.toLowerCase() !== 'y' && answer !== '') {
        console.log(chalk.gray('  Skipped.'));
        continue;
      }

      // Stash only on first actual apply, not upfront
      if (!stashedAlready) {
        const stashRes = await exec(`git stash push -m "hackbridge-fix-${Date.now()}"`, { timeoutMs: 10000 });
        if (stashRes.exitCode === 0) {
          console.log(chalk.gray('  (Stashed working changes as safety backup)'));
        }
        stashedAlready = true;
      }

      console.log(chalk.gray('  Executing...'));
      const execRes = await exec(cmd.command, { stream: true, timeoutMs: 60000 });
      if (execRes.exitCode === 0) {
        console.log(chalk.green('  ✓ Applied successfully'));
      } else {
        console.log(chalk.red(`  ✗ Failed (exit ${execRes.exitCode})`));
        if (execRes.stderr) {
          console.log(chalk.gray(`    ${execRes.stderr.split('\n')[0]}`));
        }
      }
    }
  }

  rl.close();
  console.log(chalk.bold.green('\n✓ Fix flow completed.'));
  if (stashedAlready) {
    console.log(chalk.gray('  Your original changes were stashed. Run `git stash pop` to restore them.'));
  }
}
