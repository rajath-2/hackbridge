#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initAction } from './commands/init';
import { statusAction } from './commands/status';
import { pingAction } from './commands/ping';

const program = new Command();

program
  .name('hackbridge')
  .description('HackBridge Event Intelligence CLI')
  .version('1.5.0');
program
  .command('init <cli_token>')
  .description('Initialize HackBridge in the current repository')
  .option('--api <url>', 'Override Backend API URL', 'http://localhost:8000')
  .action(initAction);

program
  .command('status')
  .description('Show team and matching status')
  .action(statusAction);

program
  .command('analyse')
  .description('Run local codebase analysis')
  .action(() => {
    console.log(chalk.blue('Analysing codebase...'));
  });

program
  .command('changes')
  .description('Show commit summary history')
  .action(() => {
    console.log(chalk.blue('Fetching commit summaries...'));
  });

program
  .command('stats')
  .description('Show commit metrics')
  .action(() => {
    console.log(chalk.blue('Calculating stats...'));
  });

program
  .command('activity')
  .description('Show team activity timeline')
  .action(() => {
    console.log(chalk.blue('Fetching activity...'));
  });

program
  .command('ping')
  .description('Request help from your assigned mentor')
  .action(pingAction);

program
  .command('timeline')
  .description('Show event judging rounds timeline')
  .action(() => {
    console.log(chalk.blue('Fetching event timeline...'));
  });

program
  .command('checklist')
  .description('Check submission readiness')
  .action(() => {
    console.log(chalk.blue('Checking readiness...'));
  });

program
  .command('submit')
  .description('Finalize and submit the project')
  .action(() => {
    console.log(chalk.blue('Submitting project...'));
  });

program.parse(process.argv);
