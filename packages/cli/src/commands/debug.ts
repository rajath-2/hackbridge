import { Command } from 'commander';
import { loadState } from '../utils/state';
import { assembleContext } from '../debug/context-assembler';
import { queryGroqRelay } from '../debug/groq-client';
import { runBisect } from '../debug/bisect';
import { applyPatch } from '../debug/apply-patch';
import { printSection, printSeparator } from '../utils/render';
import axios from 'axios';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export function registerDebugCommand(program: Command): void {
  program.command('debug')
    .description('AI-powered error analysis')
    .option('--last', 'Read from .hackbridge/last_stderr.log')
    .option('--file <path>', 'Read from specified log file')
    .option('--apply', 'Apply single-file patch if suggested')
    .option('--bisect [n]', 'Git bisect simulation (default: last 10 commits)')
    .option('--ping-mentor', 'Attach debug report to mentor notification')
    .option('--explain', 'Add conceptual WHY section to output')
    .action(async (options) => {
      const cwd = process.cwd();

      let state;
      try {
        const { loadState } = await import('../utils/state');
        state = await loadState();
      } catch {
        console.error(chalk.red('Error: project not initialized. Run `hackbridge init <cli_token>` first.'));
        process.exit(1);
      }


      let errorLog = '';

      if (!process.stdin.isTTY) {
        // Pipe mode
        errorLog = await new Promise((resolve) => {
          let data = '';
          process.stdin.on('data', chunk => data += chunk);
          process.stdin.on('end', () => resolve(data));
        });
        
        // Save for --last
        const logPath = path.join(cwd, '.hackbridge', 'last_stderr.log');
        await fs.ensureDir(path.dirname(logPath));
        await fs.writeFile(logPath, `[${new Date().toISOString()}]\n${errorLog}`);
      } else if (options.last) {
        const logPath = path.join(cwd, '.hackbridge', 'last_stderr.log');
        if (fs.existsSync(logPath)) {
          errorLog = await fs.readFile(logPath, 'utf8');
        } else {
          console.log(chalk.red('No previous log found.'));
          return;
        }
      } else if (options.file) {
        if (fs.existsSync(options.file)) {
          errorLog = await fs.readFile(options.file, 'utf8');
        } else {
          console.log(chalk.red(`File not found: ${options.file}`));
          return;
        }
      }

      if (!errorLog) {
        console.log(chalk.yellow('No error log provided. Pipe stderr to `hackbridge debug` or use --last.'));
        return;
      }

      try {
        console.log(chalk.blue('Assembling context...'));
        const context = await assembleContext(cwd, state, errorLog);
        
        console.log(chalk.blue('Querying Groq (via HackBridge Relay)...'));
        const analysis = await queryGroqRelay(state, 'debug', context, { explain: options.explain });

        printSection('AI Debug Analysis');
        console.log(analysis);

        if (options.bisect) {
          const n = typeof options.bisect === 'string' ? parseInt(options.bisect) : 10;
          const errorPattern = errorLog.split('\n')[0].substring(0, 50); // Use first line as pattern
          const { runBisect } = await import('../debug/bisect');
          await runBisect(cwd, n, errorPattern);
        }

        if (options.apply) {
          const { applyPatch } = await import('../debug/apply-patch');
          await applyPatch(cwd, analysis);
        }

        if (options.pingMentor) {
          console.log(chalk.blue('\nNotifying mentor...'));
          try {
            await axios.post(`${state.api_base}/teams/${state.team_id}/cli/debug-ping`, {
              cli_token: state.cli_token,
              team_code: state.team_code,
              stack_trace: context.stack_trace,
              stack_identity: context.stack_identity,
              debug_output: analysis,
              git_diff_summary: '', // Could be derived
              timestamp: new Date().toISOString()
            });
            
            const frontendBase = state.api_base.replace(/:8000/, ':3000');
            console.log(chalk.green('✓ Mentor notified via HackBridge platform.'));
            console.log(chalk.gray(`  They can view it at: ${frontendBase}/dashboard/participant`));
          } catch (e) {
            console.log(chalk.red('Failed to notify mentor.'));
          }
        }
      } catch (e: any) {
        console.error(chalk.red(`\nDebug failed: ${e.message}`));
      }
    });
}
