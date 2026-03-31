import { join } from "path";
import { existsSync } from "fs";
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { RefactoringPlan } from '@girardelli/architect-core/src/core/types/rules.js';
import { StackInfo, FrameworkInfo, DetectedToolchain } from './types/stack.js';
import { AgentAuditFinding, AgentItem, AgentItemStatus, AgentSuggestion} from './types/agent.js';
import {  EnrichedTemplateContext } from './types/template.js';
import { DomainInsights, ModuleDetail, DetectedEndpoint } from './types/domain.js';

import { ContextBuilder } from "./engines/context-builder.js";
import { AuditEngine } from "./engines/audit-engine.js";
import { SuggestionEngine } from "./engines/suggestion-engine.js";
import { GenerationEngine } from "./engines/generation-engine.js";
import { StackDetector } from "./stack-detector.js";

export type { StackInfo, AgentAuditFinding, AgentItem, AgentItemStatus, AgentSuggestion, EnrichedTemplateContext, DomainInsights, ModuleDetail, DetectedEndpoint, FrameworkInfo, DetectedToolchain };

/**
 * Agent Generator v3.2 — Enterprise-Grade
 *
 * Generates or audits .agent/ directories with enterprise-grade
 * agent frameworks. Delegated to specialized engines.
 */
export class AgentGenerator {
  private stackDetector = new StackDetector();
  private contextBuilder = new ContextBuilder();
  private auditEngine = new AuditEngine();
  private suggestionEngine = new SuggestionEngine();
  private generationEngine = new GenerationEngine();

  suggest(report: AnalysisReport, plan: RefactoringPlan, projectPath: string): AgentSuggestion {
    return this.suggestionEngine.suggest(report, plan, projectPath);
  }

  generate(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
    outputDir?: string
  ): { generated: string[]; audit: AgentAuditFinding[] } {
    const cleanReport = this.contextBuilder.sanitizeReport(report);
    const stack = this.stackDetector.detect(cleanReport);
    const agentDir = outputDir || join(projectPath, '.agent');
    const isExisting = existsSync(agentDir);

    if (isExisting) {
      const audit = this.auditEngine.auditExisting(agentDir, stack, cleanReport, plan);
      const generated = this.generationEngine.generateMissing(agentDir, audit, cleanReport, plan, stack, projectPath);
      return { generated, audit };
    }

    const generated = this.generationEngine.generateFull(agentDir, cleanReport, plan, stack, projectPath);
    return { generated, audit: [] };
  }
}
