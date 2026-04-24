import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import axios from 'axios';

export async function pingAction() {
  const configPath = path.join(process.cwd(), '.hackbridge', 'state.json');
  
  if (!await fs.pathExists(configPath)) {
    console.error(chalk.red('Error: project not initialized.'));
    process.exit(1);
  }

  const config = await fs.readJson(configPath);

  try {
    console.log(chalk.blue('Sending ping to your mentor...'));
    await axios.post(`${config.api_base}/teams/${config.team_id}/mentor-ping`, 
      "Help requested via CLI", 
      { headers: { 'Content-Type': 'text/plain' } }
    );
    console.log(chalk.green('✓ Ping sent! Your mentor has been notified.'));
  } catch (error: any) {
    console.error(chalk.red('Failed to send ping:'), error.response?.data?.detail || error.message);
  }
}
