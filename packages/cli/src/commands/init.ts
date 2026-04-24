import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import axios from 'axios';
import { scanDirectory } from '../scanner/filesystem';
import { installGitHook } from '../hooks/post-commit';

export async function initAction(cliToken: string, options: any) {
  const apiBase = options.api;
  const configPath = path.join(process.cwd(), '.hackbridge', 'state.json');
  
  console.log(chalk.blue('Connecting to HackBridge...'));
  
  try {
    // 0. Install Git Hook first
    await installGitHook(process.cwd());
    console.log(chalk.green('✓ Git post-commit hook installed.'));

    // 1. Validate personal token and fetch context
    const validateResp = await axios.post(`${apiBase}/users/validate-cli-token/${cliToken}`);
    const { team_id, team_code, event_id, event_code, user_name, event_start_time } = validateResp.data;

    const startTime = new Date(event_start_time);

    console.log(chalk.green(`✓ Hello ${user_name}! Personal link verified. Initializing team ${team_code}...`));

    // 2. Perform initial scan
    const scanResult = await scanDirectory(process.cwd(), startTime);
    console.log(chalk.gray(`Found ${scanResult.file_count} files. Pre-event files: ${scanResult.pre_event_files.length}`));

    // 3. Upload scan to API
    await axios.post(`${apiBase}/teams/${team_id}/scan`, {
      ...scanResult,
      team_code: team_code,
      cli_token: cliToken
    });

    // 4. Save state
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      team_id,
      event_id,
      team_code: team_code,
      event_code: event_code,
      cli_token: cliToken,
      api_base: apiBase,
      initialized_at: new Date().toISOString()
    }, { spaces: 2 });

    // 5. Auto-update .gitignore (Gap Fix #12)
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, 'utf8');
      if (!content.includes('.hackbridge')) {
        await fs.appendFile(gitignorePath, '\n# HackBridge Internal State\n.hackbridge/\n');
        console.log(chalk.gray('✓ Added .hackbridge/ to .gitignore'));
      }
    } else {
       await fs.writeFile(gitignorePath, '.hackbridge/\n');
    }

    console.log(chalk.bold.green('\n🚀 HackBridge initialized successfully!'));
    console.log(chalk.cyan('You can now use `hackbridge status` to track your progress.'));

  } catch (error: any) {
    console.error(chalk.red('\nInitialization failed:'), error.response?.data?.detail || error.message);
    process.exit(1);
  }
}
