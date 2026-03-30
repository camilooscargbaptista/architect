import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { AnalysisReport, RefactoringPlan } from '../../types.js';
import { StackInfo, AgentAuditFinding } from '../types.js';

export class AuditEngine {
  public auditExisting(
    agentDir: string,
    stack: StackInfo,
    report: AnalysisReport,
    plan: RefactoringPlan,
  ): AgentAuditFinding[] {
    const findings: AgentAuditFinding[] = [];

    const checkExists = (subpath: string, category: string, desc: string): void => {
      const full = join(agentDir, subpath);
      if (!existsSync(full)) {
        findings.push({ type: 'MISSING', category, file: subpath, description: desc });
      } else {
        findings.push({ type: 'OK', category, file: subpath, description: `${subpath} exists` });
      }
    };

    checkExists('INDEX.md', 'core', 'Master navigation guide');
    checkExists('agents/AGENT-ORCHESTRATOR.md', 'agents', 'Orchestrator agent with approval gates');
    checkExists('rules/00-general.md', 'rules', 'Golden rules and conventions');
    checkExists('rules/01-architecture.md', 'rules', 'Layer rules, dependency direction, module patterns');
    checkExists('rules/02-security.md', 'rules', 'OWASP, input validation, secrets management');
    checkExists('guards/PREFLIGHT.md', 'guards', '6-phase preflight checklist');
    checkExists('guards/QUALITY-GATES.md', 'guards', '3-level quality gates');
    checkExists('guards/CODE-REVIEW-CHECKLIST.md', 'guards', 'Structured code review checklist');
    checkExists('workflows/new-feature.md', 'workflows', '10-step feature workflow with approval gates');
    checkExists('workflows/fix-bug.md', 'workflows', 'Diagnostic bug fix workflow');

    checkExists('templates/C4.md', 'templates', 'C4 architecture template');
    checkExists('templates/BDD.md', 'templates', 'BDD scenario template');
    checkExists('templates/TDD.md', 'templates', 'TDD test template');
    checkExists('templates/ADR.md', 'templates', 'ADR decision record template');
    checkExists('templates/THREAT-MODEL.md', 'templates', 'STRIDE threat model template');

    if (stack.hasBackend) {
      const found = this.findAgentByRole(agentDir, 'backend');
      if (!found) {
        findings.push({
          type: 'MISSING', category: 'agents',
          file: `agents/${stack.primary.toUpperCase()}-BACKEND-DEVELOPER.md`,
          description: `No backend developer agent for ${stack.primary}`,
        });
      }
    }
    if (stack.hasFrontend) {
      const found = this.findAgentByRole(agentDir, 'frontend');
      if (!found) {
        findings.push({
          type: 'MISSING', category: 'agents',
          file: 'agents/FRONTEND-DEVELOPER.md',
          description: 'No frontend developer agent',
        });
      }
    }

    if (plan.steps.length > 0) {
      const found = this.findAgentByRole(agentDir, 'tech-debt');
      if (!found) {
        findings.push({
          type: 'IMPROVEMENT', category: 'agents',
          file: 'agents/TECH-DEBT-CONTROLLER.md',
          description: `${plan.steps.length} refactoring steps found but no Tech Debt agent`,
          suggestion: 'Create a Tech Debt Controller to track and prioritize refactoring',
        });
      }
    }

    if (report.score.overall < 80) {
      findings.push({
        type: 'IMPROVEMENT', category: 'guards',
        file: 'guards/QUALITY-GATES.md',
        description: `Score is ${report.score.overall}/100 — quality gates should enforce improvement`,
        suggestion: `Set minimum score threshold to ${report.score.overall + 5} and add regression guards`,
      });
    }

    return findings;
  }

  public findAgentByRole(agentDir: string, role: string): string | null {
    const dir = join(agentDir, 'agents');
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir);
    for (const file of files) {
      const content = readFileSync(join(dir, file), 'utf-8').toLowerCase();
      if (content.includes(role)) return file;
    }
    return null;
  }
}
