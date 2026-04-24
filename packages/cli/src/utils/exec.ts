import { exec as cpExec } from 'child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export async function exec(
  command: string,
  options?: {
    cwd?: string;
    timeoutMs?: number;
    stream?: boolean;
  }
): Promise<ExecResult> {
  const timeoutMs = options?.timeoutMs ?? 30000;

  return new Promise((resolve) => {
    const child = cpExec(
      command,
      {
        cwd: options?.cwd,
        timeout: timeoutMs,
        env: { ...process.env, FORCE_COLOR: '1' },
        // Increase buffer to 10 MB — avoids ENOBUFS on large pip check output
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const timedOut = !!error && (error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: error ? ((error as NodeJS.ErrnoException).code === 'ETIMEDOUT' ? 124 : 1) : 0,
          timedOut,
        });
      }
    );

    if (options?.stream) {
      child.stdout?.on('data', (data: Buffer) => process.stdout.write(data));
      child.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
    }
  });
}
