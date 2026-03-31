import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';
import { readFileSync } from 'fs';

export interface FrameworkDetectorStrategy {
  detect(projectPath: string, out: FrameworkInfo[]): void;
}

export abstract class BaseDetector implements FrameworkDetectorStrategy {
  abstract detect(projectPath: string, out: FrameworkInfo[]): void;

  protected safeReadFile(path: string): string {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return '';
    }
  }
}
