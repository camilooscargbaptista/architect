import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '../types.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class NodeDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    const pkgPath = join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) return;

    const content = this.safeReadFile(pkgPath);
    try {
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(allDeps)) {
        const fwInfo = FRAMEWORK_MAP[name];
        if (fwInfo) {
          const vStr = typeof version === 'string' ? version : '';
          const vMatch = vStr.match(/([0-9][0-9.]*)/);
          out.push({ name: fwInfo.name, version: vMatch?.[1] || null, category: fwInfo.category, confidence: 0.95 });
        }
      }
    } catch {
      // Invalid JSON
    }
  }
}
