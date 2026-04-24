import * as fs from 'fs-extra';
import * as path from 'path';

export interface ScanResult {
  file_count: number;
  directory_depth: number;
  language_breakdown: Record<string, number>;
  pre_event_files: string[];
  scan_timestamp: string;
}

export async function scanDirectory(dir: string, startTime: Date): Promise<ScanResult> {
  const result: ScanResult = {
    file_count: 0,
    directory_depth: 0,
    language_breakdown: {},
    pre_event_files: [],
    scan_timestamp: new Date().toISOString(),
  };

  async function walk(currentDir: string, depth: number) {
    result.directory_depth = Math.max(result.directory_depth, depth);
    const files = await fs.readdir(currentDir);

    for (const file of files) {
      if (file === '.git' || file === 'node_modules' || file === '.hackbridge') continue;
      
      const fullPath = path.join(currentDir, file);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else {
        result.file_count++;
        
        // Language breakdown
        const ext = path.extname(file).toLowerCase() || 'no-extension';
        result.language_breakdown[ext] = (result.language_breakdown[ext] || 0) + 1;

        // Pre-event check (ctime/mtime)
        if (stat.ctime < startTime || stat.mtime < startTime) {
          result.pre_event_files.push(path.relative(dir, fullPath));
        }
      }
    }
  }

  await walk(dir, 1);
  return result;
}
