import { Command } from 'commander';
import chalk from 'chalk';
import { gitLog, gitRevCount } from '../utils/git';
import { printSection } from '../utils/render';

export function registerGitCommands(program: Command): void {
  program
    .command('changes')
    .description('Show recent commit summary history')
    .option('-n, --number <n>', 'Number of commits to show', '10')
    .action(async (options) => {
      console.log(chalk.blue('Fetching commit history...'));
      try {
        const n = parseInt(options.number);
        const commits = await gitLog(n);
        
        printSection(`Recent Changes (last ${commits.length})`);
        if (commits.length === 0) {
          console.log(chalk.gray('No commits found.'));
          return;
        }

        commits.forEach(c => {
          console.log(`${chalk.yellow(c.hash.substring(0, 7))} ${chalk.bold(c.message)}`);
          console.log(`  ${chalk.gray(`${c.author} | ${c.date}`)}`);
        });
      } catch (e: any) {
        console.error(chalk.red(`Failed to fetch changes: ${e.message}`));
      }
    });

  program
    .command('stats')
    .description('Show repository commit metrics')
    .action(async () => {
      console.log(chalk.blue('Calculating repository stats...'));
      try {
        const count = await gitRevCount();
        const commits = await gitLog(100); // Sample last 100 for stats
        
        printSection('Repository Metrics');
        console.log(`Total Commits:   ${chalk.cyan(count)}`);
        
        if (commits.length > 0) {
          const authors = new Set(commits.map(c => c.author));
          console.log(`Active Authors:  ${chalk.cyan(authors.size)}`);
          
          // Basic velocity (commits in last 100)
          const first = new Date(commits[commits.length - 1].date);
          const last = new Date(commits[0].date);
          const days = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
          const velocity = (commits.length / days).toFixed(2);
          
          console.log(`Commit Velocity: ${chalk.cyan(velocity)} commits/day (last 100)`);
        }
      } catch (e: any) {
        console.error(chalk.red(`Failed to calculate stats: ${e.message}`));
      }
    });

  program
    .command('activity')
    .description('Show team activity timeline')
    .action(async () => {
      console.log(chalk.blue('Fetching activity timeline...'));
      try {
        const commits = await gitLog(20);
        printSection('Activity Timeline');
        
        if (commits.length === 0) {
          console.log(chalk.gray('No recent activity.'));
          return;
        }

        commits.reverse().forEach((c, idx) => {
          const prefix = idx === commits.length - 1 ? '└──' : '├──';
          console.log(`${chalk.gray(prefix)} ${chalk.yellow(new Date(c.date).toLocaleTimeString())} ${chalk.white(c.message)}`);
        });
      } catch (e: any) {
        console.error(chalk.red(`Failed to fetch activity: ${e.message}`));
      }
    });
}
