import { Command } from 'commander';
import chalk from 'chalk';
import axios from 'axios';
import { loadState } from '../utils/state';
import { printSection, printCheck, CheckResult, printSummary } from '../utils/render';
import { runPhase1 } from '../doctor/phase1';
import { runPhase2 } from '../doctor/phase2';
import { runPhase3 } from '../doctor/phase3';
import { detectStack } from '../doctor/stack-fingerprint';

export function registerEventCommands(program: Command): void {
  program
    .command('timeline')
    .description('Show event judging rounds timeline')
    .action(async () => {
      try {
        const state = await loadState();
        console.log(chalk.blue('Fetching event timeline...'));
        
        const res = await axios.get(`${state.api_base}/events/${state.event_id}`, {
          params: { cli_token: state.cli_token }
        });
        const event = res.data;
        
        printSection(`${event.name} - Judging Timeline`);
        const rounds = event.judging_rounds || [];
        
        if (rounds.length === 0) {
          console.log(chalk.gray('No judging rounds defined for this event.'));
        } else {
          rounds.forEach((r: any, idx: number) => {
            const start = new Date(r.start_time);
            const now = new Date();
            const isPast = start < now;
            const color = isPast ? chalk.gray : chalk.cyan;
            
            console.log(`${color(idx + 1 + '.')} ${chalk.bold(r.name)}`);
            console.log(`   Start: ${color(start.toLocaleString())}`);
            console.log(`   Criteria: ${r.criteria?.join(', ') || 'General'}`);
            console.log('');
          });
        }
      } catch (e: any) {
        console.error(chalk.red(`Failed to fetch timeline: ${e.message}`));
      }
    });

  program
    .command('checklist')
    .description('Check submission readiness')
    .action(async () => {
      try {
        const state = await loadState();
        const cwd = process.cwd();
        console.log(chalk.blue('Running submission readiness checklist...'));
        
        const stacks = await detectStack(cwd);
        
        // Checklist is essentially a non-interactive doctor run
        const p1 = await runPhase1(cwd, stacks);
        const p2 = await runPhase2(cwd, stacks);
        const p3 = await runPhase3(cwd, state, stacks);
        
        const all = [...p1, ...p2, ...p3];
        
        printSection('Submission Checklist');
        all.forEach(r => printCheck(r.label, r.severity, r.message));
        
        const fails = all.filter(r => r.severity === 'FAIL').length;
        if (fails > 0) {
          console.log(chalk.bold.red(`\n✗ YOU ARE NOT READY TO SUBMIT.`));
          console.log(chalk.red(`  Please fix the ${fails} critical issues first.`));
        } else {
          console.log(chalk.bold.green(`\n✓ YOU ARE READY TO SUBMIT!`));
          console.log(chalk.green('  Run `hackbridge submit` to finalize your entry.'));
        }
      } catch (e: any) {
        console.error(chalk.red(`Checklist failed: ${e.message}`));
      }
    });

  program
    .command('submit')
    .description('Finalize and submit the project')
    .action(async () => {
      try {
        const state = await loadState();
        console.log(chalk.bold.blue('🚀 Starting final submission process...'));
        
        // 1. One last check
        const stacks = await detectStack(process.cwd());
        const p3 = await runPhase3(process.cwd(), state, stacks);
        const fails = p3.filter(r => r.severity === 'FAIL');
        
        if (fails.length > 0) {
          console.log(chalk.red('✗ Submission aborted: phase 3 compliance checks failed.'));
          fails.forEach(f => printCheck(f.label, f.severity, f.message));
          return;
        }

        // 2. In reality, this would hit a submission endpoint
        console.log(chalk.gray('Uploading final snapshot...'));
        // await axios.post(`${state.api_base}/teams/${state.team_id}/submit`, { ... });
        
        console.log(chalk.bold.green('\n🎉 PROJECT SUBMITTED SUCCESSFULLY!'));
        console.log(chalk.green('   Your entry has been recorded for judging. Good luck!'));
        
      } catch (e: any) {
        console.error(chalk.red(`Submission failed: ${e.message}`));
      }
    });
}
