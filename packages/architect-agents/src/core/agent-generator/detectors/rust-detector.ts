import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class RustDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    const cargoPath = join(projectPath, 'Cargo.toml');
    if (!existsSync(cargoPath)) return;

    const content = this.safeReadFile(cargoPath);
    for (const [key, fwInfo] of Object.entries(FRAMEWORK_MAP)) {
      if (content.includes(`"${key}"`) || content.includes(`'${key}'`) || content.includes(`${key} =`)) {
        out.push({ name: fwInfo.name, version: null, category: fwInfo.category, confidence: 0.85 });
      }
    }
  }
}
