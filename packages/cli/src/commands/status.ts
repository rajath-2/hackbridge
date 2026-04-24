import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import axios from 'axios';
import { loadState } from '../utils/state';

export async function statusAction() {
  let state;
  try {
    state = await loadState();
  } catch (e: any) {
    console.error(chalk.red('Error: project not initialized. Run `hackbridge init <cli_token>` first.'));
    process.exit(1);
  }

  console.log(chalk.blue(`Fetching status for Team ${state.team_id}...`));

  try {
    const resp = await axios.get(
      `${state.api_base}/teams/${state.team_id}/cli/status`,
      {
        params: { team_code: state.team_code },
        timeout: 8000,
      }
    );
    const { team, recent_commits } = resp.data;

    console.log(chalk.bold.white('\n─── Team Status ────────────────────'));
    console.log(`  Name:       ${chalk.cyan(team.name)}`);
    console.log(`  Track:      ${chalk.cyan(team.selected_track || 'not set')}`);
    console.log(`  Mentor:     ${chalk.cyan(team.mentor?.name || 'Not assigned')}`);
    if (team.mentor_match_score != null) {
      console.log(`  Match Score:${chalk.cyan(` ${team.mentor_match_score}%`)}`);
    }
    console.log(`  Event:      ${chalk.cyan(state.event_code)}`);

    console.log(chalk.bold.white('\n─── Recent Activity ─────────────────'));
    if (!recent_commits || recent_commits.length === 0) {
      console.log(chalk.gray('  No commits recorded yet.'));
    } else {
      recent_commits.forEach((c: any) => {
        const time = new Date(c.timestamp).toLocaleTimeString();
        console.log(`  ${chalk.yellow(time)}  ${c.ai_summary || c.message || '(no summary)'}`);
      });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.error(chalk.red('Failed to fetch status: server timed out'));
    } else {
      console.error(chalk.red('Failed to fetch status:'), error.response?.data?.detail || error.message);
    }
  }
}
