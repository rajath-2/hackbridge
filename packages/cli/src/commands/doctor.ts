import { Command } from 'commander';
import chalk from 'chalk';
import { loadStateOptional } from '../utils/state';
import { detectStack, StackName } from '../doctor/stack-fingerprint';
import { runPhase1 } from '../doctor/phase1';
import { runPhase2 } from '../doctor/phase2';
import { runPhase3 } from '../doctor/phase3';
import { printSection, printSummary, CheckResult, printCheck } from '../utils/render';
import { runFixFlow } from '../doctor/fix-flow';
import { startWatcher, stopWatcher } from '../doctor/watcher';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Verify environment, stack, and track compliance')
    .option('--quick', 'Run Phase 1 FAIL checks only')
    .option('--watch', 'Background daemon mode — re-run on config file changes')
    .option('--watch-stop', 'Stop the background watcher daemon')
    .option('--stack <name>', 'Force stack detection: nextjs|mern|fastapi|prisma|supabase|node')
    .option('--phase <n>', 'Run only a specific phase: 1, 2, or 3')
    .option('--fix', 'Enter guided AI-powered fix flow for all FAIL items')
    .action(async (options) => {
      const cwd = process.cwd();

      if (options.watchStop) {
        stopWatcher(cwd);
        return;
      }

      // State is optional — phases 1 & 2 work without it; phase 3 degrades gracefully
      const state = await loadStateOptional();
      if (!state) {
        console.log(chalk.yellow('⚠ Not initialized — Phase 3 (track compliance) will be skipped.'));
        console.log(chalk.gray('  Run `hackbridge init <cli_token>` to enable full diagnostics.\n'));
      }

      const runner = async (): Promise<CheckResult[]> => {
        const stacks = await detectStack(cwd, options.stack as StackName | undefined);

        if (stacks.length > 0) {
          const stackNames = stacks.map(s => `${s.name}${s.version ? ` ${s.version}` : ''}`).join(', ');
          console.log(chalk.gray(`Detected stacks: ${stackNames}\n`));
        }

        let allResults: CheckResult[] = [];

        // Phase 1
        if (!options.phase || options.phase === '1') {
          const p1 = await runPhase1(cwd, stacks);
          printSection('Phase 1: Environment');
          p1.forEach(r => printCheck(r.label, r.severity, r.message));
          allResults.push(...p1);
        }

        // Phase 2
        if (!options.phase || options.phase === '2') {
          const p2 = await runPhase2(cwd, stacks);
          printSection('Phase 2: Stack Integrity');
          if (p2.length === 0) {
            console.log(chalk.gray('  (no stack-specific checks to run)'));
          } else {
            p2.forEach(r => printCheck(r.label, r.severity, r.message));
          }
          allResults.push(...p2);
        }

        // Phase 3
        if (!options.phase || options.phase === '3') {
          const p3 = await runPhase3(cwd, state, stacks);
          printSection('Phase 3: Track Compliance');
          p3.forEach(r => printCheck(r.label, r.severity, r.message));
          allResults.push(...p3);
        }

        printSummary(allResults);

        if (options.fix) {
          const fails = allResults.filter(r => r.severity === 'FAIL');
          if (state) {
            await runFixFlow(state, fails);
          } else {
            console.log(chalk.red('\n--fix requires initialization. Run `hackbridge init <cli_token>` first.'));
          }
        }

        return allResults;
      };

      if (options.watch) {
        startWatcher(cwd, runner);
      } else {
        await runner();
      }
    });
}
