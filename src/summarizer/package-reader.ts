import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { AnalysisReport, ProjectSummary, FileNode, WorkspaceInfo } from '../types.js';

export class PackageReader {
public readPackageJson(projectPath: string): Record<string, unknown> {
    const candidates = [
      join(projectPath, 'package.json'),
      join(projectPath, 'pyproject.toml'),
      join(projectPath, 'pubspec.yaml'),
      join(projectPath, 'Cargo.toml'),
      join(projectPath, 'pom.xml'),
      join(projectPath, 'build.gradle'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        try {
          if (candidate.endsWith('.json')) {
            return JSON.parse(readFileSync(candidate, 'utf-8'));
          }
          // For non-JSON, return raw content as 'raw' field
          return { raw: readFileSync(candidate, 'utf-8'), type: basename(candidate) };
        } catch {
          // ignore
        }
      }
    }
    return {};
  }

}
