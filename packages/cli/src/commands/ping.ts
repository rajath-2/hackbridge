import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import axios from 'axios';
import { loadState } from '../utils/state';

export async function pingAction() {
  let state;
  try {
    state = await loadState();
  } catch (e: any) {
    console.error(chalk.red('Error: project not initialized. Run `hackbridge init <cli_token>` first.'));
    process.exit(1);
  }

  try {
    console.log(chalk.blue('Sending ping to your mentor...'));
    await axios.post(
      `${state.api_base}/teams/${state.team_id}/cli/mentor-ping`,
      {
        cli_token: state.cli_token,
        team_code: state.team_code,
        message: 'Help requested via CLI',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      }
    );
    console.log(chalk.green('✓ Ping sent! Your mentor has been notified.'));
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.error(chalk.red('Failed to send ping: server timed out'));
    } else {
      console.error(chalk.red('Failed to send ping:'), error.response?.data?.detail || error.message);
    }
  }
}
