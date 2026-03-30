import { AnalysisReport } from './types/core.js';
import { ProjectSummary } from './types/summarizer.js';

import { PackageReader } from './summarizer/package-reader.js';
import { ReadmeReader } from './summarizer/readme-reader.js';
import { KeywordExtractor } from './summarizer/keyword-extractor.js';
import { PurposeInferrer } from './summarizer/purpose-inferrer.js';
import { ModuleInferrer } from './summarizer/module-inferrer.js';

/**
 * ProjectSummarizer — infers what a project does from its metadata,
 * structure, README, package.json, and file naming conventions.
 *
 * Refactored via Facade pattern in v5.0.0
 */
export class ProjectSummarizer {
  private packageReader = new PackageReader();
  private readmeReader = new ReadmeReader();
  private keywordExtractor = new KeywordExtractor();
  private purposeInferrer = new PurposeInferrer();
  private moduleInferrer = new ModuleInferrer();

  summarize(projectPath: string, report: AnalysisReport): ProjectSummary {
    const packageInfo = this.packageReader.readPackageJson(projectPath);
    const readmeContent = this.readmeReader.readReadme(projectPath);
    const modules = this.moduleInferrer.inferModules(report, projectPath);
    const entryPoints = this.purposeInferrer.findEntryPoints(report, projectPath);
    const keywords = this.keywordExtractor.extractKeywords(packageInfo, readmeContent, modules, report);
    const techStack = this.purposeInferrer.buildTechStack(report, packageInfo);
    const description = this.purposeInferrer.buildDescription(packageInfo, readmeContent, report);
    const purpose = this.purposeInferrer.inferPurpose(keywords, modules, report);

    return {
      description,
      purpose,
      modules,
      techStack,
      entryPoints,
      keywords,
    };
  }
}
