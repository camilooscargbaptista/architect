import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '../types/stack.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class PythonDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    // requirements.txt
    const reqFiles = ['requirements.txt', 'requirements/base.txt', 'requirements/prod.txt'];
    for (const reqFile of reqFiles) {
      const path = join(projectPath, reqFile);
      if (existsSync(path)) {
        const content = this.safeReadFile(path);
        this.parsePythonRequirements(content, out);
      }
    }

    // pyproject.toml
    const pyproject = join(projectPath, 'pyproject.toml');
    if (existsSync(pyproject)) {
      const content = this.safeReadFile(pyproject);
      this.parsePyprojectToml(content, out);
    }

    // setup.py / setup.cfg
    const setupPy = join(projectPath, 'setup.py');
    if (existsSync(setupPy)) {
      const content = this.safeReadFile(setupPy);
      this.parsePythonRequirements(content, out);
    }

    // Pipfile
    const pipfile = join(projectPath, 'Pipfile');
    if (existsSync(pipfile)) {
      const content = this.safeReadFile(pipfile);
      this.parsePythonRequirements(content, out);
    }
  }


private parsePythonRequirements(content: string, out: FrameworkInfo[]): void {
    const lines = content.toLowerCase().split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/#.*$/, '').trim();
      if (!cleaned) continue;

      // Match: package==1.0.0, package>=1.0, package~=1.0, package[extras]
      const match = cleaned.match(/^([a-z0-9_-]+)(?:\[.*?\])?\s*(?:[=<>~!]+\s*([0-9][0-9.]*\S*))?/);
      if (match) {
        const pkg = match[1].replace(/-/g, '-');
        const version = match[2] || null;
        const fwInfo = FRAMEWORK_MAP[pkg];
        if (fwInfo) {
          out.push({ name: fwInfo.name, version, category: fwInfo.category, confidence: 0.95 });
        }
      }
    }
  }
private parsePyprojectToml(content: string, out: FrameworkInfo[]): void {
    // Strategy 1: [project.dependencies] section (legacy format)
    const depSection = content.match(/\[(?:project\.)?dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (depSection) {
      this.parsePythonRequirements(depSection[1], out);
    }

    // Strategy 2: [project] section with inline `dependencies = [...]` (PEP 621 format)
    // This is the standard pyproject.toml format used by most modern Python projects
    const projectSection = content.match(/\[project\]\s*\n([\s\S]*?)(?:\n\[(?!project\.)|$)/);
    if (projectSection) {
      // Extract the dependencies array: dependencies = [ "pkg>=1.0", ... ]
      const depsArrayMatch = projectSection[1].match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (depsArrayMatch) {
        // Extract quoted strings from the array
        const deps = depsArrayMatch[1].match(/"([^"]+)"/g);
        if (deps) {
          const depsAsLines = deps.map(d => d.replace(/"/g, '')).join('\n');
          this.parsePythonRequirements(depsAsLines, out);
        }
      }
    }

    // Strategy 3: [project.optional-dependencies] sections (dev, test, etc.)
    const optionalDeps = content.match(/\[project\.optional-dependencies\]\s*\n([\s\S]*?)(?:\n\[(?!project\.)|$)/);
    if (optionalDeps) {
      // Parse each group: dev = ["pkg>=1.0", ...], test = [...]
      const groupMatches = optionalDeps[1].matchAll(/\w+\s*=\s*\[([\s\S]*?)\]/g);
      for (const groupMatch of groupMatches) {
        const deps = groupMatch[1].match(/"([^"]+)"/g);
        if (deps) {
          const depsAsLines = deps.map(d => d.replace(/"/g, '')).join('\n');
          this.parsePythonRequirements(depsAsLines, out);
        }
      }
    }

    // Strategy 4: tool.poetry.dependencies
    const poetrySection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (poetrySection) {
      const lines = poetrySection[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^([a-z0-9_-]+)\s*=\s*"?([^"]*)"?/i);
        if (match) {
          const pkg = match[1].toLowerCase();
          const fwInfo = FRAMEWORK_MAP[pkg];
          if (fwInfo) {
            const versionMatch = match[2].match(/([0-9][0-9.]*)/);
            out.push({ name: fwInfo.name, version: versionMatch?.[1] || null, category: fwInfo.category, confidence: 0.95 });
          }
        }
      }
    }

    // Deduplicate by framework name (keep highest confidence)
    const seen = new Map<string, number>();
    for (let i = out.length - 1; i >= 0; i--) {
      const key = out[i].name;
      if (seen.has(key)) {
        out.splice(i, 1);
      } else {
        seen.set(key, i);
      }
    }
  }
}
