import * as chokidar from 'chokidar';
import * as notifier from 'node-notifier';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { CheckResult } from '../utils/render';

export function startWatcher(cwd: string, onUpdate: () => Promise<CheckResult[]>) {
  if (process.platform === 'win32') {
    console.log(chalk.yellow('\n⚠  Windows detected. File watching uses polling fallback.'));
    console.log(chalk.yellow('   Events may be delayed by ~1 second on network/synced drives.\n'));
  }

  const pidPath = path.join(cwd, '.hackbridge', 'watch.pid');
  fs.ensureDirSync(path.dirname(pidPath));
  fs.writeFileSync(pidPath, process.pid.toString());

  const watcher = chokidar.watch(
    ['.env', '.env.example', 'package.json', 'requirements.txt', 'prisma/schema.prisma', 'main.py', 'app.py'],
    {
      cwd,
      ignoreInitial: true,
      usePolling: process.platform === 'win32',
      interval: 1000,
    }
  );

  console.log(chalk.blue(`[Watcher] Started (PID: ${process.pid})`));
  console.log(chalk.gray('[Watcher] Watching for configuration changes. Press Ctrl+C to stop.\n'));

  const runAndNotify = async (changedFile?: string) => {
    if (changedFile) {
      console.log(chalk.cyan(`\n[Watcher] Change in ${changedFile} — re-running checks...`));
    }
    try {
      const results = await onUpdate();
      const fails = results.filter(r => r.severity === 'FAIL');
      if (fails.length > 0) {
        notifyBlocker(
          `${fails.length} issue${fails.length > 1 ? 's' : ''} detected`,
          fails.map(f => `✗ ${f.label}: ${f.message}`).join('\n')
        );
      }
    } catch (e: any) {
      console.error(chalk.red('[Watcher] Error running checks:'), e.message);
    }
  };

  watcher.on('change', (filePath) => runAndNotify(filePath));
  watcher.on('add', (filePath) => runAndNotify(filePath));
  watcher.on('unlink', (filePath) => runAndNotify(filePath));

  process.on('SIGINT', () => {
    console.log(chalk.gray('\n[Watcher] Stopped.'));
    watcher.close();
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
    process.exit(0);
  });
}

export function stopWatcher(cwd: string): void {
  const pidPath = path.join(cwd, '.hackbridge', 'watch.pid');
  if (!fs.existsSync(pidPath)) {
    console.log(chalk.yellow('No active watcher found.'));
    return;
  }
  const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim());
  try {
    process.kill(pid, 'SIGINT');
    fs.unlinkSync(pidPath);
    console.log(chalk.green(`✓ Watcher (PID: ${pid}) stopped.`));
  } catch (e: any) {
    if (e.code === 'ESRCH') {
      // Process already dead, just clean up
      fs.unlinkSync(pidPath);
      console.log(chalk.yellow('Watcher was not running. Cleaned up stale PID file.'));
    } else {
      console.log(chalk.red(`Failed to stop watcher: ${e.message}`));
    }
  }
}

export function notifyBlocker(title: string, message: string): void {
  notifier.notify({
    title: `HackBridge — ${title}`,
    message,
    sound: true,
    wait: false,
  });
}
