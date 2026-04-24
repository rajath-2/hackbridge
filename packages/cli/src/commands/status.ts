import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import axios from 'axios';

export async function statusAction() {
  const configPath = path.join(process.cwd(), '.hackbridge', 'state.json');
  
  if (!await fs.pathExists(configPath)) {
    console.error(chalk.red('Error: project not initialized. Run `hackbridge init <team_code>` first.'));
    process.exit(1);
  }

  const config = await fs.readJson(configPath);
  console.log(chalk.blue(`Fetching status for Team ${config.team_id}...`));

  try {
    const resp = await axios.get(`${config.api_base}/teams/${config.team_id}/cli/status?team_code=${config.team_code}`);
    const { team, recent_commits } = resp.data;

    console.log(chalk.bold.white('\n--- Team Status ---'));
    console.log(`Name:      ${chalk.cyan(team.name)}`);
    console.log(`Track:     ${chalk.cyan(team.selected_track)}`);
    console.log(`Mentor:    ${chalk.cyan(team.mentor?.name || 'Not assigned')}`);
    console.log(`Match Qual:${chalk.cyan(team.mentor_match_score || 0)}%`);
    
    console.log(chalk.bold.white('\n--- Recent Activity ---'));
    if (recent_commits.length === 0) {
      console.log(chalk.gray('No commits recorded yet.'));
    } else {
      recent_commits.forEach((c: any) => {
        console.log(`- ${chalk.yellow(new Date(c.timestamp).toLocaleTimeString())}: ${c.ai_summary}`);
      });
    }

  } catch (error: any) {
    console.error(chalk.red('Failed to fetch status:'), error.message);
  }
}
