import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { AnalysisReport } from '../types/core.js';
import { ProjectSummary } from '../types/summarizer.js';
import { FileNode, WorkspaceInfo } from '../types/infrastructure.js';

export class ReadmeReader {
public readReadme(projectPath: string): string {
    const candidates = ['README.md', 'readme.md', 'README.txt', 'README', 'README.rst'];
    for (const name of candidates) {
      const path = join(projectPath, name);
      if (existsSync(path)) {
        try {
          // Read first 3000 chars — enough for description, skip excessive content
          return readFileSync(path, 'utf-8').slice(0, 3000);
        } catch {
          // ignore
        }
      }
    }
    return '';
  }

}
