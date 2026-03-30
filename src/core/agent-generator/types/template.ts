import { AnalysisReport } from '../../types/core.js';
import { RefactoringPlan } from '../../types/rules.js';
import { StackInfo, FrameworkInfo, DetectedToolchain } from './stack.js';
import { DomainInsights, ModuleDetail, DetectedEndpoint } from './domain.js';
import { AgentGeneratorConfig } from './agent.js';

export interface TemplateContext {
  report: AnalysisReport;
  plan: RefactoringPlan;
  stack: StackInfo;
  projectName: string;
  stackLabel: string;
  config: AgentGeneratorConfig;
}

export interface EnrichedTemplateContext extends TemplateContext {
  domain: DomainInsights;
  modules: ModuleDetail[];
  endpoints: DetectedEndpoint[];
  untestedModules: string[];
  criticalPaths: string[]; // files with highest coupling
  projectDepth: 'small' | 'medium' | 'large' | 'enterprise'; // drives template verbosity
  /** Detected frameworks with versions */
  detectedFrameworks: FrameworkInfo[];
  /** Primary web framework (e.g., 'FastAPI', 'NestJS', 'Django') */
  primaryFramework: FrameworkInfo | null;
  /** Detected toolchain commands */
  toolchain: DetectedToolchain;
  /** Real project structure pattern detected */
  projectStructure: 'clean-architecture' | 'mvc' | 'modular' | 'flat' | 'monorepo' | 'unknown';
}
