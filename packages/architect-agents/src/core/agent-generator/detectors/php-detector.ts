import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class PhpDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    const composerPath = join(projectPath, 'composer.json');
    if (!existsSync(composerPath)) return;

    const content = this.safeReadFile(composerPath);
    try {
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.require, ...pkg['require-dev'] };
      for (const [name, version] of Object.entries(allDeps)) {
        const fwInfo = FRAMEWORK_MAP[name];
        if (fwInfo) {
          const vStr = typeof version === 'string' ? version : '';
          const vMatch = vStr.match(/([0-9][0-9.]*)/);
          out.push({ name: fwInfo.name, version: vMatch?.[1] || null, category: fwInfo.category, confidence: 0.9 });
        }
      }
    } catch {
      // Invalid JSON
    }
  }
}
