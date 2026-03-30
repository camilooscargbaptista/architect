import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '../types/stack.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class GoDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    const goModPath = join(projectPath, 'go.mod');
    if (!existsSync(goModPath)) return;

    const content = this.safeReadFile(goModPath);
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(github\.com\/[^\s]+)/);
      if (match) {
        const modPath = match[1].toLowerCase();
        for (const [key, fwInfo] of Object.entries(FRAMEWORK_MAP)) {
          if (modPath.includes(key.toLowerCase())) {
            out.push({ name: fwInfo.name, version: null, category: fwInfo.category, confidence: 0.9 });
          }
        }
      }
    }
  }
}
