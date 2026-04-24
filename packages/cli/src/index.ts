#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initAction } from './commands/init';
import { statusAction } from './commands/status';
import { pingAction } from './commands/ping';
import { registerDoctorCommand } from './commands/doctor';
import { registerDebugCommand } from './commands/debug';
import { registerAnalyseCommand } from './commands/analyse';
import { registerGitCommands } from './commands/git';
import { registerEventCommands } from './commands/event';
import { registerCollaborationCommands } from './commands/collaboration';

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
  .command('ping')
  .description('Request help from your assigned mentor')
  .action(pingAction);

// Feature-rich command modules
registerDoctorCommand(program);
registerDebugCommand(program);
registerAnalyseCommand(program);
registerGitCommands(program);
registerEventCommands(program);
registerCollaborationCommands(program);

program.parse(process.argv);
