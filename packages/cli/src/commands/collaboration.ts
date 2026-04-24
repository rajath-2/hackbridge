import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { EnvScanner } from '../scanner/env-scanner';

const API_BASE = process.env.HACKBRIDGE_API_URL || 'http://localhost:8000';

export function registerCollaborationCommands(program: Command) {
    const collab = program.command('collab').description('Developer collaboration and environment sync');

    collab.command('sync')
        .description('Scan local environment and sync with team members')
        .option('-m, --message <msg>', 'Custom sync message')
        .action(async (options) => {
            try {
                const statePath = path.join(process.cwd(), '.hackbridge', 'state.json');
                if (!await fs.pathExists(statePath)) {
                    console.log(chalk.red('Project not initialized. Run hackbridge init first.'));
                    return;
                }

                const state = await fs.readJson(statePath);
                if (!state.team_id || !state.cli_token) {
                    console.log(chalk.red('Incomplete state. Please re-run hackbridge init.'));
                    return;
                }

                console.log(chalk.blue('🔍 Scanning local environment...'));
                const scanner = new EnvScanner(process.cwd());
                const result = await scanner.scan();

                console.log(chalk.blue('📤 Syncing with HackBridge...'));
                const response = await axios.post(`${API_BASE}/collaboration/sync`, {
                    team_id: state.team_id,
                    team_code: state.team_code,
                    cli_token: state.cli_token,
                    dependencies: result.dependencies,
                    tools: result.tools,
                    env_keys: result.envKeys,
                    message: options.message
                });

                if (response.data.status === 'success') {
                    console.log(chalk.green('✅ Sync complete!'));
                    if (response.data.has_changes) {
                        console.log(chalk.yellow('🔄 Changes detected and recorded in team history.'));
                    }
                }
            } catch (error: any) {
                console.error(chalk.red('❌ Sync failed:'), error.response?.data?.detail || error.message);
            }
        });

    collab.command('status')
        .description('Check if your local environment matches the Team Official Master')
        .action(async () => {
            try {
                const statePath = path.join(process.cwd(), '.hackbridge', 'state.json');
                if (!await fs.pathExists(statePath)) {
                    console.log(chalk.red('Project not initialized.'));
                    return;
                }

                const state = await fs.readJson(statePath);
                
                console.log(chalk.blue('🔍 Checking drift status...'));
                
                // 1. Scan local
                const scanner = new EnvScanner(process.cwd());
                const local = await scanner.scan();

                // 2. Get official state
                const response = await axios.get(`${API_BASE}/collaboration/team/${state.team_id}`, {
                    headers: { 'Authorization': `Bearer ${state.cli_token}` }
                });

                const { official_state } = response.data;

                if (!official_state) {
                    console.log(chalk.yellow('⚠️ No official state defined for this team yet.'));
                    console.log(chalk.gray('Team leader can set the official state from the web dashboard.'));
                    return;
                }

                const officialDeps = official_state.dependencies || {};
                const localDeps = local.dependencies;
                
                let drifts = 0;
                console.log(chalk.bold('\nDependency Drift Audit:'));
                
                for (const [name, reqVer] of Object.entries(officialDeps)) {
                    const localVer = localDeps[name];
                    if (!localVer) {
                        console.log(`${chalk.red('✖')} ${name}: ${chalk.red('Missing')} (Expected ${reqVer})`);
                        drifts++;
                    } else if (localVer !== reqVer) {
                        console.log(`${chalk.yellow('⚠')} ${name}: ${chalk.yellow(localVer)} (Official: ${reqVer})`);
                        drifts++;
                    } else {
                        console.log(`${chalk.green('✔')} ${name}: ${localVer} ${chalk.gray('(Synced)')}`);
                    }
                }

                if (drifts === 0) {
                    console.log(chalk.green('\n✅ Your environment is fully aligned with the Official Master!'));
                } else {
                    console.log(chalk.red(`\n❌ Detected ${drifts} drifts. Please align your environment with the team.`));
                }

            } catch (error: any) {
                 console.error(chalk.red('❌ Status check failed:'), error.response?.data?.detail || error.message);
            }
        });
}
