import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import axios from 'axios';
import { scanDirectory } from '../scanner/filesystem';
import { installGitHook } from '../hooks/post-commit';

export async function initAction(teamCode: string, options: any) {
  const apiBase = options.api;
  const configPath = path.join(process.cwd(), '.hackbridge', 'state.json');
  
  console.log(chalk.blue('Connecting to HackBridge...'));
  
  try {
    // 0. Install Git Hook first (fails early if not a git repo)
    await installGitHook(process.cwd());
    console.log(chalk.green('✓ Git post-commit hook installed.'));

    // 1. Validate team code and fetch event start time
    // For this implementation, we assume the API has a public endpoint for validation
    const teamResp = await axios.get(`${apiBase}/teams/validate/${teamCode}`);
    const { team_id, event_id } = teamResp.data;

    const eventResp = await axios.get(`${apiBase}/events/${event_id}`);
    const startTime = new Date(eventResp.data.start_time);
    const eventCode = eventResp.data.event_code;

    console.log(chalk.green('✓ Team verified. Starting initial codebase scan...'));

    // 2. Perform initial scan
    const scanResult = await scanDirectory(process.cwd(), startTime);
    console.log(chalk.gray(`Found ${scanResult.file_count} files. Pre-event files: ${scanResult.pre_event_files.length}`));

    // 3. Upload scan to API
    await axios.post(`${apiBase}/teams/${team_id}/scan`, {
      ...scanResult,
      team_code: teamCode
    });

    // 4. Save state
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      team_id,
      event_id,
      team_code: teamCode,
      event_code: eventCode,
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
