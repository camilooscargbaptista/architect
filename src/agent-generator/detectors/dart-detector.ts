import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '../types.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class DartDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    const pubspecPath = join(projectPath, 'pubspec.yaml');
    if (!existsSync(pubspecPath)) return;

    const content = this.safeReadFile(pubspecPath);
    if (content.includes('flutter:')) {
      out.push({ name: 'Flutter', version: null, category: 'web', confidence: 0.95 });
    }
  }
}
