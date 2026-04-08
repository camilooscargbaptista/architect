import { basename, dirname } from 'path';
import { RefactoringPlan, FileOperation } from './types/rules.js';

/**
 * Severity of a validation issue.
 * - ERROR: Plan is unsafe to execute — will cause broken state
 * - WARNING: Plan may produce suboptimal results but won't break
 * - INFO: Suggestion for improvement
 */
export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

/**
 * Category of validation check that detected the issue.
 */
export type ValidationCategory =
  | 'CIRCULAR_OPERATION'
  | 'ORPHAN_IMPORT'
  | 'INCOMPLETE_SPLIT'
  | 'PATH_COLLISION'
  | 'SCOPE_VIOLATION'
  | 'ORDER_DEPENDENCY'
  | 'EMPTY_STEP';

export interface ValidationIssue {
  severity: ValidationSeverity;
  category: ValidationCategory;
  stepId: number;
  message: string;
  /** Affected file paths */
  paths: string[];
  /** Suggested fix */
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
}

/**
 * GenesisValidator — Consistency validation for RefactoringPlan.
 *
 * Runs 6 validation passes to detect structural problems before
 * prompts are generated or operations are executed:
 *
 * 1. Circular operation detection
 * 2. Orphan import detection (MOVE/DELETE without consumer MODIFY)
 * 3. Incomplete split detection (SPLIT without all consumers updated)
 * 4. Path collision detection (two ops target same path)
 * 5. Scope validation (ops reference only project files)
 * 6. Empty step detection
 *
 * @since v8.2.0 — Fase 3.5
 */
export class GenesisValidator {
  /**
   * Validate a refactoring plan for structural consistency.
   *
   * @param plan - The plan to validate
   * @param projectFiles - Optional set of known project files for scope validation
   */
  validate(plan: RefactoringPlan, projectFiles?: Set<string>): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Run all validation passes
    this.checkCircularOperations(plan, issues);
    this.checkOrphanImports(plan, issues);
    this.checkIncompleteSplits(plan, issues);
    this.checkPathCollisions(plan, issues);
    this.checkEmptySteps(plan, issues);

    if (projectFiles) {
      this.checkScopeViolations(plan, projectFiles, issues);
    }

    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;
    const infoCount = issues.filter(i => i.severity === 'INFO').length;

    return {
      valid: errorCount === 0,
      errorCount,
      warningCount,
      infoCount,
      issues,
    };
  }

  /**
   * Pass 1: Circular operation detection.
   *
   * If Step N creates a file and Step M (M < N) modifies it,
   * the execution order is wrong. Also detects cases where a
   * step both creates and deletes the same path.
   */
  private checkCircularOperations(plan: RefactoringPlan, issues: ValidationIssue[]): void {
    // Track which step creates each file
    const createdByStep = new Map<string, number>();

    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'CREATE') {
          createdByStep.set(op.path, step.id);
        }
      }
    }

    // Check if any step modifies/deletes a file created by a LATER step
    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'MODIFY' || op.type === 'DELETE') {
          const creatorStep = createdByStep.get(op.path);
          if (creatorStep !== undefined && creatorStep > step.id) {
            issues.push({
              severity: 'ERROR',
              category: 'CIRCULAR_OPERATION',
              stepId: step.id,
              message: `Step ${step.id} ${op.type}s "${basename(op.path)}" but it's created later in Step ${creatorStep}`,
              paths: [op.path],
              suggestion: `Reorder steps so Step ${creatorStep} (CREATE) runs before Step ${step.id} (${op.type})`,
            });
          }
        }
      }

      // Check for same-step CREATE+DELETE on same path
      const stepPaths = new Map<string, FileOperation['type'][]>();
      for (const op of step.operations) {
        const existing = stepPaths.get(op.path);
        if (existing) {
          existing.push(op.type);
        } else {
          stepPaths.set(op.path, [op.type]);
        }
      }

      for (const [path, ops] of stepPaths) {
        if (ops.includes('CREATE') && ops.includes('DELETE')) {
          issues.push({
            severity: 'ERROR',
            category: 'CIRCULAR_OPERATION',
            stepId: step.id,
            message: `Step ${step.id} both CREATEs and DELETEs "${basename(path)}"`,
            paths: [path],
            suggestion: 'Remove contradictory operations on the same file within one step',
          });
        }
      }
    }
  }

  /**
   * Pass 2: Orphan import detection.
   *
   * When a file is MOVEd or DELETEd, any file that imports it
   * should have a corresponding MODIFY operation to update imports.
   * Without this, the codebase breaks after execution.
   */
  private checkOrphanImports(plan: RefactoringPlan, issues: ValidationIssue[]): void {
    // Collect all files being moved or deleted
    const movedOrDeleted = new Map<string, { stepId: number; type: 'MOVE' | 'DELETE'; newPath?: string }>();

    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'MOVE' || op.type === 'DELETE') {
          const entry: { stepId: number; type: 'MOVE' | 'DELETE'; newPath?: string } = {
            stepId: step.id,
            type: op.type,
          };
          if (op.type === 'MOVE' && op.newPath) entry.newPath = op.newPath;
          movedOrDeleted.set(op.path, entry);
        }
      }
    }

    // Collect all files being modified (potential import updates)
    const modifiedFiles = new Set<string>();
    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'MODIFY') {
          modifiedFiles.add(op.path);
        }
      }
    }

    // For each moved/deleted file, check if consumers are being updated
    // We can't know the full consumer list without the dependency graph,
    // so we check for a heuristic: if a file is MOVEd and no MODIFY ops
    // exist in the same step or any later step, that's suspicious.
    for (const [path, info] of movedOrDeleted) {
      const stepOps = plan.steps.find(s => s.id === info.stepId)?.operations ?? [];
      const hasConsumerUpdate = stepOps.some(
        op => op.type === 'MODIFY' && op.path !== path && op.description.toLowerCase().includes('import')
      );

      // Also check other steps for MODIFY operations mentioning this file
      const anyConsumerUpdate = plan.steps.some(s =>
        s.operations.some(
          op => op.type === 'MODIFY' && op.description.includes(basename(path))
        )
      );

      if (!hasConsumerUpdate && !anyConsumerUpdate) {
        issues.push({
          severity: info.type === 'MOVE' ? 'WARNING' : 'INFO',
          category: 'ORPHAN_IMPORT',
          stepId: info.stepId,
          message: `"${basename(path)}" is ${info.type}d but no consumer MODIFY operations found to update imports`,
          paths: [path, ...(info.newPath ? [info.newPath] : [])],
          suggestion: info.type === 'MOVE'
            ? `Add MODIFY operations for files that import "${basename(path)}" to update their import paths`
            : `Verify no other files depend on "${basename(path)}" before deletion`,
        });
      }
    }
  }

  /**
   * Pass 3: Incomplete split detection.
   *
   * When a hub file is split (rule: hub-splitter), the step should
   * include MODIFY operations for ALL consumers listed in the step
   * description. If consumers are mentioned but not in operations, flag it.
   */
  private checkIncompleteSplits(plan: RefactoringPlan, issues: ValidationIssue[]): void {
    for (const step of plan.steps) {
      if (step.rule !== 'hub-splitter') continue;

      const createOps = step.operations.filter(op => op.type === 'CREATE');
      const modifyOps = step.operations.filter(op => op.type === 'MODIFY');

      // A hub split should have: N CREATE ops (new modules) + M MODIFY ops (consumers + original)
      if (createOps.length > 0 && modifyOps.length === 0) {
        issues.push({
          severity: 'ERROR',
          category: 'INCOMPLETE_SPLIT',
          stepId: step.id,
          message: `Hub split creates ${createOps.length} new module(s) but has no MODIFY operations for consumers`,
          paths: createOps.map(op => op.path),
          suggestion: 'Add MODIFY operations for all files that import the original hub file',
        });
      }

      // Check ratio: should have at least 1 MODIFY for the original file
      const hasOriginalModify = modifyOps.some(op =>
        createOps.some(c => dirname(c.path) === dirname(op.path)) ||
        op.description.toLowerCase().includes('refactor') ||
        op.description.toLowerCase().includes('extract')
      );

      if (createOps.length > 0 && !hasOriginalModify) {
        issues.push({
          severity: 'WARNING',
          category: 'INCOMPLETE_SPLIT',
          stepId: step.id,
          message: `Hub split creates new modules but doesn't modify the original hub file`,
          paths: createOps.map(op => op.path),
          suggestion: 'Add a MODIFY operation for the original hub file to extract split functionality',
        });
      }
    }
  }

  /**
   * Pass 4: Path collision detection.
   *
   * Two operations should not CREATE the same file path.
   * Two operations should not MOVE different files to the same newPath.
   */
  private checkPathCollisions(plan: RefactoringPlan, issues: ValidationIssue[]): void {
    // Check cross-step CREATE collisions
    const createTargets = new Map<string, number[]>();

    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'CREATE') {
          const existing = createTargets.get(op.path);
          if (existing) {
            existing.push(step.id);
          } else {
            createTargets.set(op.path, [step.id]);
          }
        }
      }
    }

    for (const [path, stepIds] of createTargets) {
      if (stepIds.length > 1) {
        issues.push({
          severity: 'ERROR',
          category: 'PATH_COLLISION',
          stepId: stepIds[0]!,
          message: `"${basename(path)}" is CREATEd by multiple steps: ${stepIds.join(', ')}`,
          paths: [path],
          suggestion: 'Consolidate CREATE operations into a single step or use unique file names',
        });
      }
    }

    // Check MOVE destination collisions
    const moveTargets = new Map<string, { stepId: number; source: string }[]>();

    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'MOVE' && op.newPath) {
          const existing = moveTargets.get(op.newPath);
          const entry = { stepId: step.id, source: op.path };
          if (existing) {
            existing.push(entry);
          } else {
            moveTargets.set(op.newPath, [entry]);
          }
        }
      }
    }

    for (const [target, sources] of moveTargets) {
      if (sources.length > 1) {
        issues.push({
          severity: 'ERROR',
          category: 'PATH_COLLISION',
          stepId: sources[0]!.stepId,
          message: `Multiple files MOVEd to "${basename(target)}": ${sources.map(s => basename(s.source)).join(', ')}`,
          paths: [target, ...sources.map(s => s.source)],
          suggestion: 'Ensure each MOVE has a unique destination path',
        });
      }
    }

    // Check CREATE→MOVE collision (CREATE a path that a MOVE also targets)
    for (const [path, createSteps] of createTargets) {
      const moveToSame = moveTargets.get(path);
      if (moveToSame) {
        issues.push({
          severity: 'ERROR',
          category: 'PATH_COLLISION',
          stepId: createSteps[0]!,
          message: `"${basename(path)}" is both CREATEd (Step ${createSteps.join(',')}) and a MOVE target (Step ${moveToSame.map(s => s.stepId).join(',')})`,
          paths: [path],
          suggestion: 'Resolve the conflict — a file cannot be both CREATEd and MOVEd to',
        });
      }
    }
  }

  /**
   * Pass 5: Scope validation.
   *
   * Operations should only reference files that exist in the project
   * (for MODIFY, MOVE, DELETE) or create files within the project tree
   * (for CREATE). Flags operations that reference paths outside the project.
   */
  private checkScopeViolations(
    plan: RefactoringPlan,
    projectFiles: Set<string>,
    issues: ValidationIssue[],
  ): void {
    // Collect all files that will be created by the plan itself
    const planCreated = new Set<string>();
    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'CREATE') planCreated.add(op.path);
      }
    }

    for (const step of plan.steps) {
      for (const op of step.operations) {
        if (op.type === 'MODIFY' || op.type === 'DELETE') {
          if (!projectFiles.has(op.path) && !planCreated.has(op.path)) {
            issues.push({
              severity: 'WARNING',
              category: 'SCOPE_VIOLATION',
              stepId: step.id,
              message: `${op.type} targets "${basename(op.path)}" which is not in the project file set`,
              paths: [op.path],
              suggestion: 'Verify the file path exists in the project or remove this operation',
            });
          }
        }

        if (op.type === 'MOVE') {
          if (!projectFiles.has(op.path) && !planCreated.has(op.path)) {
            issues.push({
              severity: 'WARNING',
              category: 'SCOPE_VIOLATION',
              stepId: step.id,
              message: `MOVE source "${basename(op.path)}" is not in the project file set`,
              paths: [op.path],
              suggestion: 'Verify the source file path exists',
            });
          }
        }
      }
    }
  }

  /**
   * Pass 6: Empty step detection.
   *
   * Steps with zero operations are useless and may indicate
   * a bug in rule analysis.
   */
  private checkEmptySteps(plan: RefactoringPlan, issues: ValidationIssue[]): void {
    for (const step of plan.steps) {
      if (step.operations.length === 0) {
        issues.push({
          severity: 'WARNING',
          category: 'EMPTY_STEP',
          stepId: step.id,
          message: `Step ${step.id} ("${step.title}") has no operations`,
          paths: [],
          suggestion: 'Remove empty steps or investigate why the rule produced no operations',
        });
      }
    }
  }
}
