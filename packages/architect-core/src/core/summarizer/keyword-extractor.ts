// import { existsSync, readFileSync } from 'fs';
// import { join, basename } from 'path';
import { AnalysisReport } from '../types/core.js';
import { ProjectSummary } from '../types/summarizer.js';
// import { FileNode, WorkspaceInfo } from '../types/infrastructure.js';

export class KeywordExtractor {
  public static readonly KEYWORD_BLACKLIST = new Set([
    'node_modules', 'dist', 'build', '.git', '.next', 'coverage',
    '__tests__', '__mocks__', 'src', 'lib', 'index', 'main',
    'out', 'tmp', '.cache', 'vendor', '.vscode', '.idea',
  ]);

public extractKeywords(
    packageInfo: Record<string, unknown>,
    _readme: string,
    modules: ProjectSummary['modules'],
    report: AnalysisReport,
  ): string[] {
    const keywords = new Set<string>();

    // From package.json keywords
    if (Array.isArray(packageInfo['keywords'])) {
      for (const kw of packageInfo['keywords']) {
        if (typeof kw === 'string') keywords.add(kw.toLowerCase());
      }
    }

    // From module names (only clean names)
    for (const mod of modules) {
      const name = mod.name.toLowerCase();
      if (!KeywordExtractor.KEYWORD_BLACKLIST.has(name)) {
        keywords.add(name);
      }
    }

    // From frameworks detected
    for (const fw of report.projectInfo.frameworks) {
      keywords.add(fw.toLowerCase());
    }

    // From languages
    for (const lang of report.projectInfo.primaryLanguages) {
      keywords.add(lang.toLowerCase());
    }

    // Filter out blacklisted and generic entries
    return [...keywords]
      .filter(kw => !KeywordExtractor.KEYWORD_BLACKLIST.has(kw) && kw.length > 1)
      .slice(0, 20);
  }

}
