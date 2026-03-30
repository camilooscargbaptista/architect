import { AnalysisReport, RefactoringPlan } from '../types.js';
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
