import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = 'src/agent-generator/context-enricher.ts';
const DEST_DIR = 'src/agent-generator/enrichers';

if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });

const content = readFileSync(SRC, 'utf8');

// 1. DTO and TYPES
const baseImports = `import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AnalysisReport } from '../../types.js';
import { ModuleDetail, DetectedEndpoint, EnrichedTemplateContext } from '../types.js';\n\n`;

// Extract Classifiers
// Layer Classifier (isTest, isEntity, isController, isGenericDir, inferFileLayer, etc)

let layerClassifier = baseImports + `export class LayerClassifier {
`;
const layerMethods = [
  'isTestFile', 'isEntityFile', 'isControllerOrRouteFile', 
  'isServiceFile', 'isGenericDir', 'inferFileLayer', 'extractEntityName',
  'fileReferencesAuth', 'fileReferencesValidation'
];

layerMethods.forEach(m => {
  const r = new RegExp(`private ${m}\\([\\w\\W]*?\\n(?:  }\\n(?:\\n|  //))`);
  const match = content.match(r);
  if (match) {
    layerClassifier += match[0].replace('private ', 'public ') + '\n';
  }
});
layerClassifier += `}\n`;
writeFileSync(join(DEST_DIR, 'layer-classifier.ts'), layerClassifier);

// Description Generator 
let descGenerator = baseImports + `export class DescriptionGenerator {
`;
const descMatch = content.match(/(private generateSmartDescription[\w\W]*?\n  }\n)/);
if (descMatch) {
  descGenerator += descMatch[1].replace('private ', 'public ') + '\n';
}
descGenerator += `}\n`;
writeFileSync(join(DEST_DIR, 'description-generator.ts'), descGenerator);

// Analysis Helpers (findUntestedModules, countFileLines, classifyProjectDepth, findCriticalPaths)
let analysisHelpers = baseImports + `export class AnalysisHelpers {
`;
['findUntestedModules', 'findCriticalPaths', 'classifyProjectDepth', 'countFileLines'].forEach(m => {
  const r = new RegExp(`private ${m}\\([\\w\\W]*?\\n(?:  }\\n(?:\\n|  //))`);
  const match = content.match(r);
  if (match) {
    analysisHelpers += match[0].replace('private ', 'public ') + '\n';
  }
});
analysisHelpers += `}\n`;
writeFileSync(join(DEST_DIR, 'analysis-helpers.ts'), analysisHelpers);

// Module Extractor
let modExtractor = baseImports + `import { LayerClassifier } from './layer-classifier.js';
import { DescriptionGenerator } from './description-generator.js';
import { AnalysisHelpers } from './analysis-helpers.js';

export class ModuleExtractor {
  private layerClassifier = new LayerClassifier();
  private descriptionGenerator = new DescriptionGenerator();
  private analysisHelpers = new AnalysisHelpers();

`;
['extractModules', 'inferModuleName', 'inferModulePath'].forEach(m => {
  const r = new RegExp(`private ${m}\\([\\w\\W]*?\\n(?:  }\\n(?:\\n|  //))`);
  const match = content.match(r);
  if (match) {
    let methodBody = match[0].replace('private ', 'public ');
    
    // Rewrite "this." references 
    methodBody = methodBody.replace(/this\.inferModuleName/g, 'this.inferModuleName');
    methodBody = methodBody.replace(/this\.inferModulePath/g, 'this.inferModulePath');
    methodBody = methodBody.replace(/this\.countFileLines/g, 'this.analysisHelpers.countFileLines');
    methodBody = methodBody.replace(/this\.inferFileLayer/g, 'this.layerClassifier.inferFileLayer');
    methodBody = methodBody.replace(/this\.isTestFile/g, 'this.layerClassifier.isTestFile');
    methodBody = methodBody.replace(/this\.isEntityFile/g, 'this.layerClassifier.isEntityFile');
    methodBody = methodBody.replace(/this\.isControllerOrRouteFile/g, 'this.layerClassifier.isControllerOrRouteFile');
    methodBody = methodBody.replace(/this\.isServiceFile/g, 'this.layerClassifier.isServiceFile');
    methodBody = methodBody.replace(/this\.extractEntityName/g, 'this.layerClassifier.extractEntityName');
    methodBody = methodBody.replace(/this\.generateSmartDescription/g, 'this.descriptionGenerator.generateSmartDescription');
    methodBody = methodBody.replace(/this\.isGenericDir/g, 'this.layerClassifier.isGenericDir');

    modExtractor += methodBody + '\n';
  }
});
modExtractor += `}\n`;
writeFileSync(join(DEST_DIR, 'module-extractor.ts'), modExtractor);

// Endpoint Extractor
let endExtractor = baseImports + `import { LayerClassifier } from './layer-classifier.js';

export class EndpointExtractor {
  private layerClassifier = new LayerClassifier();

`;
['extractEndpoints', 'extractResourceFromFile'].forEach(m => {
  const r = new RegExp(`private ${m}\\([\\w\\W]*?\\n(?:  }\\n(?:\\n|  //))`);
  const match = content.match(r);
  if (match) {
    let methodBody = match[0].replace('private ', 'public ');
    
    // Rewrite "this." references 
    methodBody = methodBody.replace(/this\.isControllerOrRouteFile/g, 'this.layerClassifier.isControllerOrRouteFile');
    methodBody = methodBody.replace(/this\.fileReferencesAuth/g, 'this.layerClassifier.fileReferencesAuth');
    methodBody = methodBody.replace(/this\.fileReferencesValidation/g, 'this.layerClassifier.fileReferencesValidation');
    methodBody = methodBody.replace(/this\.extractResourceFromFile/g, 'this.extractResourceFromFile');

    endExtractor += methodBody + '\n';
  }
});
endExtractor += `}\n`;
writeFileSync(join(DEST_DIR, 'endpoint-extractor.ts'), endExtractor);

// Finally, rebuild context-enricher.ts Facade
const facade = `import { AnalysisReport, RefactoringPlan } from '../types.js';
import {
  StackInfo,
  EnrichedTemplateContext,
  AgentGeneratorConfig,
  DEFAULT_AGENT_CONFIG,
} from './types.js';
import { DomainInferrer } from './domain-inferrer.js';
import { FrameworkDetector } from './framework-detector.js';

// Engines
import { ModuleExtractor } from './enrichers/module-extractor.js';
import { EndpointExtractor } from './enrichers/endpoint-extractor.js';
import { AnalysisHelpers } from './enrichers/analysis-helpers.js';

/**
 * ContextEnricher — Builds an EnrichedTemplateContext from AnalysisReport.
 * Refactored via Strategy/Facade into separate Extractor engines.
 */
export class ContextEnricher {
  private domainInferrer = new DomainInferrer();
  private frameworkDetector = new FrameworkDetector();
  
  private moduleExtractor = new ModuleExtractor();
  private endpointExtractor = new EndpointExtractor();
  private analysisHelpers = new AnalysisHelpers();

  enrich(
    report: AnalysisReport,
    plan: RefactoringPlan,
    stack: StackInfo,
    projectPath: string,
    config: AgentGeneratorConfig = DEFAULT_AGENT_CONFIG,
  ): EnrichedTemplateContext {
    const modules = this.moduleExtractor.extractModules(report, projectPath);
    const endpoints = this.endpointExtractor.extractEndpoints(report, modules);
    const untestedModules = this.analysisHelpers.findUntestedModules(modules);
    const criticalPaths = this.analysisHelpers.findCriticalPaths(report);
    const projectDepth = this.analysisHelpers.classifyProjectDepth(report);
    const domain = this.domainInferrer.infer(report, projectPath);

    const fwResult = this.frameworkDetector.detect(projectPath, report);

    const webFrameworks = (report.projectInfo?.frameworks || [])
      .filter(f => !['Jest', 'Vitest', 'Mocha', 'ESLint', 'Prettier', 'Biome',
        'pytest', 'Ruff', 'mypy', 'Black', 'Flake8', 'RSpec',
        '@jest/globals', '@types/jest', 'ts-jest'].includes(f));
    const stackLabel = [...new Set([...stack.languages, ...webFrameworks])].join(' + ');

    return {
      report,
      plan,
      stack,
      projectName: report.projectInfo.name || 'Project',
      stackLabel,
      config,
      domain,
      modules,
      endpoints,
      untestedModules,
      criticalPaths,
      projectDepth,
      detectedFrameworks: fwResult.frameworks,
      primaryFramework: fwResult.primaryFramework,
      toolchain: fwResult.toolchain,
      projectStructure: fwResult.projectStructure,
    };
  }
}
`;
writeFileSync(SRC, facade);
console.log('Enrichers created and context-enricher Facade compiled!');
