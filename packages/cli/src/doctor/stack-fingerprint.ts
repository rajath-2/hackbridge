import * as fs from 'fs-extra';
import * as path from 'path';

export type StackName = 'nextjs' | 'mern' | 'fastapi' | 'prisma' | 'supabase' | 'node';

export interface DetectedStack {
  name: StackName;
  version?: string;
  path: string;
}

export async function detectStack(cwd: string, forceStack?: StackName): Promise<DetectedStack[]> {
  if (forceStack) {
    return [{ name: forceStack, path: cwd }];
  }

  const detected: DetectedStack[] = [];
  const visited = new Set<string>();

  async function scan(dir: string, depth: number) {
    if (depth > 2 || visited.has(dir)) return;
    visited.add(dir);

    if (!(await fs.pathExists(dir))) return;

    // 1. package.json based
    const pkgPath = path.join(dir, 'package.json');
    if (await fs.pathExists(pkgPath)) {
      try {
        const pkg = await fs.readJson(pkgPath);
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        if (deps.next) {
          detected.push({ name: 'nextjs', version: deps.next, path: dir });
        } else if (deps.react || deps.vite || deps.express) {
          detected.push({ name: 'node', path: dir }); 
        }
        
        if (deps['@prisma/client']) {
          detected.push({ name: 'prisma', version: deps['@prisma/client'], path: dir });
        }
        if (deps['@supabase/supabase-js']) {
          detected.push({ name: 'supabase', version: deps['@supabase/supabase-js'], path: dir });
        }
      } catch (e) {}
    }

    // 2. Python based
    const reqPath = path.join(dir, 'requirements.txt');
    const mainPy = path.join(dir, 'main.py');
    const appPy = path.join(dir, 'app.py');
    
    if (await fs.pathExists(reqPath)) {
      const content = await fs.readFile(reqPath, 'utf8');
      if (content.includes('fastapi')) {
        detected.push({ name: 'fastapi', path: dir });
      }
    } else if (await fs.pathExists(mainPy) || await fs.pathExists(appPy)) {
      detected.push({ name: 'fastapi', path: dir });
    }

    // 3. File markers
    if (await fs.pathExists(path.join(dir, 'prisma', 'schema.prisma'))) {
      if (!detected.some(s => s.name === 'prisma')) detected.push({ name: 'prisma', path: dir });
    }

    // Recurse if no stacks found in this dir yet (up to depth 2)
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
        await scan(path.join(dir, file.name), depth + 1);
      }
    }
  }

  await scan(cwd, 0);
  
  // Deduplicate by name
  const unique: DetectedStack[] = [];
  const names = new Set<string>();
  for (const s of detected) {
    if (!names.has(s.name)) {
      names.add(s.name);
      unique.push(s);
    }
  }

  return unique;
}
