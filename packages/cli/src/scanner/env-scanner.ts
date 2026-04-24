import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ScanResult {
    dependencies: Record<string, string>;
    tools: Record<string, string>;
    envKeys: Record<string, string>;
}

export class EnvScanner {
    private cwd: string;

    constructor(cwd: string) {
        this.cwd = cwd;
    }

    async scan(): Promise<ScanResult> {
        const [dependencies, tools, envKeys] = await Promise.all([
            this.scanDependencies(),
            this.scanTools(),
            this.scanEnvKeys()
        ]);

        return { dependencies, tools, envKeys };
    }

    private async scanDependencies(): Promise<Record<string, string>> {
        let deps: Record<string, string> = {};
        
        // 1. Node.js (package.json)
        const nodeDeps = await this.scanNodeDeps();
        deps = { ...deps, ...nodeDeps };

        // 2. Python (requirements.txt)
        const pyDeps = await this.scanPythonDeps();
        deps = { ...deps, ...pyDeps };

        // 3. Go (go.mod)
        const goDeps = await this.scanGoDeps();
        deps = { ...deps, ...goDeps };

        // 4. Rust (Cargo.toml)
        const rustDeps = await this.scanRustDeps();
        deps = { ...deps, ...rustDeps };

        return deps;
    }

    private async scanNodeDeps(): Promise<Record<string, string>> {
        const deps: Record<string, string> = {};
        const pkgPath = path.join(this.cwd, 'package.json');
        if (await fs.pathExists(pkgPath)) {
            try {
                const pkg = await fs.readJson(pkgPath);
                const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                for (const [name, reqVer] of Object.entries(allDeps)) {
                    const depPkgPath = path.join(this.cwd, 'node_modules', name, 'package.json');
                    if (await fs.pathExists(depPkgPath)) {
                        try {
                            const depPkg = await fs.readJson(depPkgPath);
                            deps[`npm:${name}`] = depPkg.version || (reqVer as string);
                        } catch {
                            deps[`npm:${name}`] = reqVer as string;
                        }
                    } else {
                        deps[`npm:${name}`] = reqVer as string; 
                    }
                }
            } catch {}
        }
        return deps;
    }

    private async scanPythonDeps(): Promise<Record<string, string>> {
        const deps: Record<string, string> = {};
        const reqPath = path.join(this.cwd, 'requirements.txt');
        if (await fs.pathExists(reqPath)) {
            try {
                const content = await fs.readFile(reqPath, 'utf8');
                const lines = content.split('\n');
                for (const line of lines) {
                    const match = line.match(/^\s*([\w.-]+)\s*==\s*([\w.-]+)/);
                    if (match) deps[`pip:${match[1].toLowerCase()}`] = match[2];
                }
            } catch {}
        }
        return deps;
    }

    private async scanGoDeps(): Promise<Record<string, string>> {
        const deps: Record<string, string> = {};
        const modPath = path.join(this.cwd, 'go.mod');
        if (await fs.pathExists(modPath)) {
            try {
                const content = await fs.readFile(modPath, 'utf8');
                const lines = content.split('\n');
                for (const line of lines) {
                    const match = line.match(/^\s*([\w./-]+)\s+v([\w.-]+)/);
                    if (match) deps[`go:${match[1]}`] = match[2];
                }
            } catch {}
        }
        return deps;
    }

    private async scanRustDeps(): Promise<Record<string, string>> {
        const deps: Record<string, string> = {};
        const cargoPath = path.join(this.cwd, 'Cargo.toml');
        if (await fs.pathExists(cargoPath)) {
            try {
                const content = await fs.readFile(cargoPath, 'utf8');
                const lines = content.split('\n');
                let inDeps = false;
                for (const line of lines) {
                    if (line.trim() === '[dependencies]') { inDeps = true; continue; }
                    if (line.startsWith('[')) { inDeps = false; continue; }
                    if (inDeps) {
                        const match = line.match(/^\s*([\w.-]+)\s*=\s*"?([\w.-]+)"?/);
                        if (match) deps[`crate:${match[1]}`] = match[2];
                    }
                }
            } catch {}
        }
        return deps;
    }

    private async scanTools(): Promise<Record<string, string>> {
        const tools: Record<string, string> = {};
        const targets = [
            'node', 'npm', 'yarn', 'pnpm', 'python', 'pip', 
            'go', 'rustc', 'cargo', 'git', 'docker'
        ];

        for (const tool of targets) {
            try {
                const output = execSync(`${tool} --version`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
                const version = output.trim().match(/(\d+\.\d+\.\d+)/)?.[1] || output.trim();
                tools[tool] = version;
            } catch {
                // Tool not found
            }
        }

        return tools;
    }

    private async scanEnvKeys(): Promise<Record<string, string>> {
        const keys: Record<string, string> = {};
        const envPath = path.join(this.cwd, '.env');

        if (await fs.pathExists(envPath)) {
            try {
                const content = await fs.readFile(envPath, 'utf8');
                const lines = content.split('\n');
                for (const line of lines) {
                    const match = line.match(/^\s*([\w.-]+)\s*=/);
                    if (match) {
                        const key = match[1];
                        keys[key] = 'present'; // We only track presence, not values for security
                    }
                }
            } catch (e) {
                console.error('Failed to read .env:', e);
            }
        }
        return keys;
    }
}
