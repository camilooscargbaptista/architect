import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '../types.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class RubyDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    const gemfilePath = join(projectPath, 'Gemfile');
    if (!existsSync(gemfilePath)) return;

    const content = this.safeReadFile(gemfilePath);
    if (content.includes("'rails'") || content.includes('"rails"')) {
      const vMatch = content.match(/['"]rails['"],\s*['"]~?>\s*([0-9.]+)['"]/);
      out.push({ name: 'Ruby on Rails', version: vMatch?.[1] || null, category: 'web', confidence: 0.95 });
    }
    if (content.includes("'sinatra'") || content.includes('"sinatra"')) {
      out.push({ name: 'Sinatra', category: 'web', version: null, confidence: 0.9 });
    }
    if (content.includes("'rspec'") || content.includes('"rspec"')) {
      out.push({ name: 'RSpec', category: 'test', version: null, confidence: 0.9 });
    }
  }
}
