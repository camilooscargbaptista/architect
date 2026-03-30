import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { AnalysisReport, RefactoringPlan } from "../../types.js";
import { StackInfo, AgentAuditFinding, EnrichedTemplateContext } from "../types.js";
import { ContextBuilder } from "./context-builder.js";

// ── Core Templates (Enterprise-Grade) ──
import { generateIndexMd } from '../templates/core/index-md.js';
import { generateOrchestrator } from '../templates/core/orchestrator.js';
import { generatePreflight } from '../templates/core/preflight.js';
import { generateQualityGates } from '../templates/core/quality-gates.js';
import { generateGeneralRules } from '../templates/core/general-rules.js';
import { generateArchitectureRules } from '../templates/core/architecture-rules.js';
import { generateSecurityRules } from '../templates/core/security-rules.js';
import { generateNewFeatureWorkflow } from '../templates/core/workflow-new-feature.js';
import { generateFixBugWorkflow } from '../templates/core/workflow-fix-bug.js';
import { generateReviewWorkflow } from '../templates/core/workflow-review.js';
import {
  generateBackendAgent,
  generateFrontendAgent,
  generateSecurityAgent,
  generateQAAgent,
  generateTechDebtAgent,
  generateCodeReviewChecklist,
  generateDatabaseAgent,
  generateMobileAgent,
} from '../templates/core/agents.js';

// ── Stack-Specific Templates ──
import { generateStackRules, getStackRuleFileName } from '../templates/stack/index.js';

// ── Domain Templates ──
import {
  generateC4Template,
  generateBddTemplate,
  generateTddTemplate,
  generateAdrTemplate,
  generateThreatModelTemplate,
} from '../templates/domain/index.js';

// ── Skills Generator ──
import { generateProjectSkills, generateArchitectIntegrationSkill, generateCIPipelineSkill, generateMonorepoGuideSkill } from '../templates/core/skills-generator.js';

// ── Hooks Generator ──
import { generatePreCommitHook, generatePrePushHook, generatePostAnalysisHook } from '../templates/core/hooks-generator.js';

export class GenerationEngine {
  private contextBuilder = new ContextBuilder();

  public generateFull(agentDir: string, report: AnalysisReport, plan: RefactoringPlan, stack: StackInfo, projectPath: string): string[] {
    const generated: string[] = [];
    const ctx = this.contextBuilder.buildContext(report, plan, stack, projectPath);

    // Create directories
    const dirs = ['agents', 'rules', 'guards', 'workflows', 'templates', 'skills', 'hooks'];
    for (const d of dirs) mkdirSync(join(agentDir, d), { recursive: true });

    // ── Core files (Enterprise-Grade) ──
    const coreFiles: Record<string, string> = {
      'INDEX.md': generateIndexMd(ctx),
      'agents/AGENT-ORCHESTRATOR.md': generateOrchestrator(ctx),
      'guards/PREFLIGHT.md': generatePreflight(ctx),
      'guards/QUALITY-GATES.md': generateQualityGates(ctx),
      'guards/CODE-REVIEW-CHECKLIST.md': generateCodeReviewChecklist(ctx),
      'rules/00-general.md': generateGeneralRules(ctx),
      'rules/01-architecture.md': generateArchitectureRules(ctx),
      'rules/02-security.md': generateSecurityRules(ctx),
      'workflows/new-feature.md': generateNewFeatureWorkflow(ctx),
      'workflows/fix-bug.md': generateFixBugWorkflow(ctx),
      'workflows/review.md': generateReviewWorkflow(ctx),
    };

    // ── Stack-specific agents ──
    if (stack.hasBackend) {
      coreFiles[`agents/${stack.primary.toUpperCase()}-BACKEND-DEVELOPER.md`] = generateBackendAgent(ctx);
    }
    if (stack.hasFrontend) {
      const FRONTEND_FWS = ['Angular', 'Vue', 'Vue.js', 'Next.js', 'React', 'Nuxt', 'Svelte', 'Remix'];
      const detectedFw = ctx.detectedFrameworks?.find(f => FRONTEND_FWS.includes(f.name));
      const fwName = detectedFw?.name ||
        stack.frameworks.find(f => FRONTEND_FWS.includes(f)) || 'Frontend';
      coreFiles[`agents/${fwName.toUpperCase().replace('.', '').replace(/\s/g, '-')}-FRONTEND-DEVELOPER.md`] = generateFrontendAgent(ctx);
    }
    if (stack.hasMobile) {
      coreFiles['agents/FLUTTER-UI-DEVELOPER.md'] = generateMobileAgent(ctx);
    }
    if (stack.hasDatabase) {
      coreFiles['agents/DATABASE-ENGINEER.md'] = generateDatabaseAgent(ctx);
    }
    coreFiles['agents/SECURITY-AUDITOR.md'] = generateSecurityAgent(ctx);
    coreFiles['agents/QA-TEST-ENGINEER.md'] = generateQAAgent(ctx);
    coreFiles['agents/TECH-DEBT-CONTROLLER.md'] = generateTechDebtAgent(ctx);

    // ── Stack-specific rules ──
    const stackRuleContent = generateStackRules(ctx);
    const stackRuleFile = getStackRuleFileName(ctx);
    if (stackRuleContent && stackRuleFile) {
      coreFiles[`rules/${stackRuleFile}.md`] = stackRuleContent;
    }

    // ── Domain templates ──
    coreFiles['templates/C4.md'] = generateC4Template(ctx);
    coreFiles['templates/BDD.md'] = generateBddTemplate(ctx);
    coreFiles['templates/TDD.md'] = generateTddTemplate(ctx);
    coreFiles['templates/ADR.md'] = generateAdrTemplate(ctx);
    coreFiles['templates/THREAT-MODEL.md'] = generateThreatModelTemplate(ctx);

    // ── Project Skills (padrões detectados) ──
    const skillsContent = generateProjectSkills(ctx);
    if (skillsContent) {
      coreFiles['skills/PROJECT-PATTERNS.md'] = skillsContent;
    }

    // ── Data-driven Skills (real project data) ──
    coreFiles['skills/ARCHITECT-INTEGRATION.md'] = generateArchitectIntegrationSkill(ctx);
    coreFiles['skills/CI-PIPELINE.md'] = generateCIPipelineSkill(ctx);

    const monorepoGuide = generateMonorepoGuideSkill(ctx);
    if (monorepoGuide) {
      coreFiles['skills/MONOREPO-GUIDE.md'] = monorepoGuide;
    }

    // ── Executable Hooks ──
    coreFiles['hooks/pre-commit.sh'] = generatePreCommitHook(ctx);
    coreFiles['hooks/pre-push.sh'] = generatePrePushHook(ctx);
    coreFiles['hooks/post-analysis.sh'] = generatePostAnalysisHook(ctx);

    // ── Write all files (with size cap) ──
    for (const [path, content] of Object.entries(coreFiles)) {
      const fullPath = join(agentDir, path);
      const dir = join(fullPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, this.contextBuilder.capContent(content));
      generated.push(path);
    }

    return generated;
  }

  public generateMissing(
    agentDir: string,
    audit: AgentAuditFinding[],
    report: AnalysisReport,
    plan: RefactoringPlan,
    stack: StackInfo,
    projectPath: string,
  ): string[] {
    const generated: string[] = [];
    const missing = audit.filter(f => f.type === 'MISSING');
    const ctx = this.contextBuilder.buildContext(report, plan, stack, projectPath);

    for (const finding of missing) {
      const fullPath = join(agentDir, finding.file);
      const dir = join(fullPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const content = this.getTemplateFor(finding.file, ctx);
      if (content) {
        writeFileSync(fullPath, content);
        generated.push(finding.file);
      }
    }

    return generated;
  }

  public getTemplateFor(file: string, ctx: EnrichedTemplateContext): string | null {
    if (file.includes('INDEX')) return generateIndexMd(ctx);
    if (file.includes('ORCHESTRATOR')) return generateOrchestrator(ctx);
    if (file.includes('PREFLIGHT')) return generatePreflight(ctx);
    if (file.includes('QUALITY-GATES')) return generateQualityGates(ctx);
    if (file.includes('CODE-REVIEW')) return generateCodeReviewChecklist(ctx);
    if (file.includes('SECURITY')) return generateSecurityAgent(ctx);
    if (file.includes('QA')) return generateQAAgent(ctx);
    if (file.includes('TECH-DEBT')) return generateTechDebtAgent(ctx);
    if (file.includes('BACKEND')) return generateBackendAgent(ctx);
    if (file.includes('FRONTEND')) return generateFrontendAgent(ctx);
    if (file.includes('FLUTTER')) return generateMobileAgent(ctx);
    if (file.includes('DATABASE')) return generateDatabaseAgent(ctx);
    if (file.includes('00-general')) return generateGeneralRules(ctx);
    if (file.includes('01-architecture')) return generateArchitectureRules(ctx);
    if (file.includes('02-security')) return generateSecurityRules(ctx);
    if (file.includes('03-')) return generateStackRules(ctx);
    if (file.includes('new-feature') || file.includes('develop')) return generateNewFeatureWorkflow(ctx);
    if (file.includes('fix-bug')) return generateFixBugWorkflow(ctx);
    if (file.includes('review')) return generateReviewWorkflow(ctx);
    if (file.includes('C4')) return generateC4Template(ctx);
    if (file.includes('BDD')) return generateBddTemplate(ctx);
    if (file.includes('TDD')) return generateTddTemplate(ctx);
    if (file.includes('ADR')) return generateAdrTemplate(ctx);
    if (file.includes('THREAT')) return generateThreatModelTemplate(ctx);
    return null;
  }
}
