import { Command } from 'commander';
import chalk from 'chalk';
import { loadStateOptional } from '../utils/state';
import { scanDirectory } from '../scanner/filesystem';
import { printSection } from '../utils/render';

export function registerAnalyseCommand(program: Command): void {
  program
    .command('analyse')
    .description('Run local codebase analysis and show insights')
    .action(async () => {
      const cwd = process.cwd();
      const state = await loadStateOptional();
      
      // Default to current time if not initialized
      const startTime = state ? new Date(state.initialized_at) : new Date();

      console.log(chalk.blue('🔍 Analysing codebase...'));
      
      try {
        const result = await scanDirectory(cwd, startTime);
        
        printSection('Codebase Analysis');
        console.log(`Total Files:     ${chalk.cyan(result.file_count)}`);
        console.log(`Max Depth:       ${chalk.cyan(result.directory_depth)}`);
        
        console.log(chalk.bold('\nLanguage Breakdown:'));
        Object.entries(result.language_breakdown)
          .sort((a, b) => b[1] - a[1])
          .forEach(([ext, count]) => {
            console.log(`  ${ext.padEnd(15)} ${chalk.yellow(count)} files`);
          });

        if (result.pre_event_files.length > 0) {
          console.log(chalk.yellow(`\n⚠ Detected ${result.pre_event_files.length} pre-event files.`));
          console.log(chalk.gray('  Use `hackbridge doctor` to check integrity details.'));
        } else {
          console.log(chalk.green('\n✓ No pre-event files detected. Integrity looks good.'));
        }

      } catch (e: any) {
        console.error(chalk.red(`Analysis failed: ${e.message}`));
      }
    });
}
