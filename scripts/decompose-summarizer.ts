import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = 'src/project-summarizer.ts';
const DEST_DIR = 'src/summarizer';

if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });

const content = readFileSync(SRC, 'utf8');

const baseImports = `import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { AnalysisReport, ProjectSummary, FileNode, WorkspaceInfo } from '../types.js';\n\n`;

// 1. PackageReader
let packageReader = baseImports + `export class PackageReader {
`;
const mPackage = content.match(/(private readPackageJson[\w\W]*?\n  }\n)/);
if(mPackage) packageReader += mPackage[1].replace('private ', 'public ') + '\n';
packageReader += `}\n`;
writeFileSync(join(DEST_DIR, 'package-reader.ts'), packageReader);

// 2. ReadmeReader
let readmeReader = baseImports + `export class ReadmeReader {
`;
const mReadme = content.match(/(private readReadme[\w\W]*?\n  }\n)/);
if(mReadme) readmeReader += mReadme[1].replace('private ', 'public ') + '\n';
readmeReader += `}\n`;
writeFileSync(join(DEST_DIR, 'readme-reader.ts'), readmeReader);

// 3. KeywordExtractor
let keywordExt = baseImports + `export class KeywordExtractor {
  public static readonly KEYWORD_BLACKLIST = new Set([
    'node_modules', 'dist', 'build', '.git', '.next', 'coverage',
    '__tests__', '__mocks__', 'src', 'lib', 'index', 'main',
    'out', 'tmp', '.cache', 'vendor', '.vscode', '.idea',
  ]);

`;
const mKey = content.match(/(private extractKeywords[\w\W]*?\n  }\n)/);
if(mKey) {
  let body = mKey[1].replace('private ', 'public ');
  body = body.replace(/ProjectSummarizer\.KEYWORD_BLACKLIST/g, 'KeywordExtractor.KEYWORD_BLACKLIST');
  keywordExt += body + '\n';
}
keywordExt += `}\n`;
writeFileSync(join(DEST_DIR, 'keyword-extractor.ts'), keywordExt);

// 4. PurposeInferrer (buildTechStack, buildDescription, inferPurpose)
let purposeInf = baseImports + `export class PurposeInferrer {
`;
['buildTechStack', 'buildDescription', 'inferPurpose', 'findEntryPoints'].forEach(m => {
  const r = new RegExp(`(private ${m}\\([\\w\\W]*?\\n  }\\n)`);
  const match = content.match(r);
  if (match) purposeInf += match[1].replace('private ', 'public ') + '\n';
});
purposeInf += `}\n`;
writeFileSync(join(DEST_DIR, 'purpose-inferrer.ts'), purposeInf);

// 5. ModuleInferrer
let modInf = `import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { AnalysisReport, ProjectSummary, WorkspaceInfo } from '../types.js';

export class ModuleInferrer {
`;
['inferModules', 'inferModulesFromWorkspaces', 'getWorkspaceDescription', 'countFilesInDir', 'inferModulesFromStructure', 'describeModule'].forEach(m => {
  const r = new RegExp(`(private ${m}\\([\\w\\W]*?\\n  }\\n)`);
  const match = content.match(r);
  if (match) {
    let mb = match[1].replace('private ', 'public ');
    mb = mb.replace(/this\.inferModulesFromWorkspaces/g, 'this.inferModulesFromWorkspaces');
    mb = mb.replace(/this\.inferModulesFromStructure/g, 'this.inferModulesFromStructure');
    mb = mb.replace(/this\.getWorkspaceDescription/g, 'this.getWorkspaceDescription');
    mb = mb.replace(/this\.countFilesInDir/g, 'this.countFilesInDir');
    mb = mb.replace(/this\.describeModule/g, 'this.describeModule');
    modInf += mb + '\n';
  }
});
modInf += `}\n`;
writeFileSync(join(DEST_DIR, 'module-inferrer.ts'), modInf);

// 6. ProjectSummarizer Facade
const facade = `import { AnalysisReport, ProjectSummary } from './types.js';

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
`;
writeFileSync(SRC, facade);
console.log('ProjectSummarizer decomposed and facade generated flawlessly!');
