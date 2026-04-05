import { RefactorStep } from '@girardelli/architect-core/src/core/types/rules.js';

/**
 * A single pass in a multi-pass prompt chain.
 * Each pass has a focused objective and receives context from previous passes.
 */
export interface PromptPass {
  /** Sequential pass number within the chain (1-based) */
  passNumber: number;
  /** Human-readable objective for this pass */
  objective: string;
  /**
   * What context this pass receives:
   * - 'source' = original file content
   * - 'previous' = output of the previous pass
   * - 'analysis' = structured analysis from a prior pass
   */
  contextSource: 'source' | 'previous' | 'analysis';
  /** Contract: what this pass MUST output (guides the LLM) */
  outputContract: string;
  /** Pass number this depends on (undefined = first pass, uses source) */
  dependsOn?: number;
  /** The actual prompt content */
  content: string;
}

/**
 * A chain of prompts for a single refactoring step.
 * Multi-pass chains break complex refactorings into sequential,
 * focused prompts where each pass feeds the next.
 */
export interface PromptChain {
  stepId: number;
  stepTitle: string;
  rule: string;
  /** Total passes in this chain */
  passCount: number;
  passes: PromptPass[];
}

/**
 * Strategy for decomposing a step into multi-pass chains.
 * Each rule type can have a different decomposition strategy.
 */
type DecompositionStrategy = (step: RefactorStep) => PromptPass[];

/**
 * MultiPassGenerator — Transforms monolithic RefactorStep prompts
 * into sequential PromptChain objects.
 *
 * Instead of one massive prompt per step, generates a chain of focused
 * prompts where each pass feeds into the next. This enables LLMs to
 * handle complex refactorings that are impossible in a single context.
 *
 * Strategy per rule:
 * - hub-splitter:      3 passes (analyze → split → update consumers)
 * - barrel-optimizer:  2 passes (analyze → replace with direct imports)
 * - import-organizer:  2 passes (generate facade → rewire imports)
 * - module-grouper:    3 passes (analyze → move → fix imports)
 * - dead-code-detector: 1 pass  (verify & remove — simple enough)
 * - default:           1 pass  (backward compat — wraps existing prompt)
 *
 * @since v9.0 — Fase 3.1
 */
export class MultiPassGenerator {
  private strategies: Map<string, DecompositionStrategy>;

  constructor() {
    this.strategies = new Map<string, DecompositionStrategy>([
      ['hub-splitter', this.decomposeHubSplitter.bind(this)],
      ['barrel-optimizer', this.decomposeBarrelOptimizer.bind(this)],
      ['import-organizer', this.decomposeImportOrganizer.bind(this)],
      ['module-grouper', this.decomposeModuleGrouper.bind(this)],
      ['dead-code-detector', this.decomposeDeadCode.bind(this)],
    ]);
  }

  /**
   * Decompose a RefactorStep into a PromptChain.
   * Falls back to single-pass wrapper if no strategy exists for the rule.
   */
  decompose(step: RefactorStep): PromptChain {
    const strategy = this.strategies.get(step.rule);
    const passes = strategy ? strategy(step) : this.defaultSinglePass(step);

    return {
      stepId: step.id,
      stepTitle: step.title,
      rule: step.rule,
      passCount: passes.length,
      passes,
    };
  }

  // ── Hub Splitter: 3 passes ────────────────────────────────────

  private decomposeHubSplitter(step: RefactorStep): PromptPass[] {
    const createOps = step.operations.filter(op => op.type === 'CREATE');
    const modifyOps = step.operations.filter(op => op.type === 'MODIFY');
    const hubFile = modifyOps.find(op =>
      op.description.toLowerCase().includes('refactor') ||
      op.description.toLowerCase().includes('extract')
    );
    const consumerOps = modifyOps.filter(op =>
      op.description.toLowerCase().includes('import')
    );

    const newModules = createOps.map(op => `\`${op.path}\``).join(', ');
    const consumers = consumerOps.map(op => `\`${op.path}\``).join(', ');

    return [
      {
        passNumber: 1,
        objective: 'Analyze the hub file and identify split boundaries',
        contextSource: 'source',
        outputContract: 'A structured JSON analysis with: (1) groups of related exports, (2) which consumers use which group, (3) proposed module names',
        content: this.buildPassPrompt(step, [
          `You are analyzing a hub file that needs to be split.`,
          hubFile ? `**Target file:** \`${hubFile.path}\`` : '',
          `**New modules to create:** ${newModules}`,
          ``,
          `**Your task (analysis only — do NOT write code yet):**`,
          `1. Read the hub file and list ALL exports (functions, classes, types, constants)`,
          `2. Group exports by domain affinity (which exports are used together?)`,
          `3. For each proposed module (${newModules}), list which exports should move there`,
          `4. List which consumers depend on which groups`,
          ``,
          `**Output format:** Structured JSON with keys: \`groups\`, \`consumerMapping\``,
        ]),
      },
      {
        passNumber: 2,
        objective: 'Generate the split module files',
        contextSource: 'previous',
        outputContract: 'Complete source code for each new module file, plus the updated original hub file',
        dependsOn: 1,
        content: this.buildPassPrompt(step, [
          `Based on the analysis from Pass 1, generate the actual code files.`,
          ``,
          `**Files to create:**`,
          ...createOps.map(op => `- \`${op.path}\`: ${op.description}`),
          ``,
          hubFile ? `**Original hub file to update:** \`${hubFile.path}\`\n- Remove extracted exports\n- Add re-exports from new modules for backward compatibility` : '',
          ``,
          `**Rules:**`,
          `- Each new module must be self-contained (no circular imports)`,
          `- Preserve ALL original exports — nothing should break`,
          `- Add JSDoc noting these files were extracted from the hub`,
          `- Use the EXACT module boundaries from the Pass 1 analysis`,
        ]),
      },
      {
        passNumber: 3,
        objective: 'Update all consumer imports',
        contextSource: 'previous',
        outputContract: 'Updated import statements for each consumer file',
        dependsOn: 2,
        content: this.buildPassPrompt(step, [
          `Now update all consumers to import from the new specific modules.`,
          ``,
          `**Consumer files to update:**`,
          ...consumerOps.map(op => `- \`${op.path}\`: ${op.description}`),
          consumers ? '' : '- (No specific consumers listed — scan for all imports of the original hub file)',
          ``,
          `**Rules:**`,
          `- Replace barrel imports with direct imports from the new modules`,
          `- Do NOT change any logic — only import paths`,
          `- If a consumer uses exports from multiple new modules, add multiple import lines`,
          `- Verify no import is left pointing to the old monolithic path`,
        ]),
      },
    ];
  }

  // ── Barrel Optimizer: 2 passes ────────────────────────────────

  private decomposeBarrelOptimizer(step: RefactorStep): PromptPass[] {
    const modifyOps = step.operations.filter(op => op.type === 'MODIFY');
    const barrelOp = modifyOps.find(op =>
      op.description.toLowerCase().includes('simplify') ||
      op.description.toLowerCase().includes('barrel')
    );
    const consumerOps = modifyOps.filter(op =>
      op.description.toLowerCase().includes('replace') ||
      op.description.toLowerCase().includes('direct import')
    );

    return [
      {
        passNumber: 1,
        objective: 'Analyze barrel re-exports and map consumer dependencies',
        contextSource: 'source',
        outputContract: 'JSON mapping: { barrel_exports: string[], consumer_dependencies: Record<consumer_path, needed_modules[]> }',
        content: this.buildPassPrompt(step, [
          `Analyze the barrel file and its consumers.`,
          barrelOp ? `**Barrel file:** \`${barrelOp.path}\`` : '',
          `**Consumers:** ${consumerOps.map(op => `\`${op.path}\``).join(', ')}`,
          ``,
          `1. List everything the barrel re-exports`,
          `2. For each consumer, determine which specific modules it actually needs`,
          `3. Output a JSON mapping of consumer → direct module paths`,
        ]),
      },
      {
        passNumber: 2,
        objective: 'Replace barrel imports with direct imports in consumers',
        contextSource: 'previous',
        outputContract: 'Updated import statements for each consumer file, and simplified barrel file',
        dependsOn: 1,
        content: this.buildPassPrompt(step, [
          `Using the dependency mapping from Pass 1, update all consumers.`,
          ``,
          `**For each consumer:**`,
          `- Remove the barrel import`,
          `- Add direct imports to the specific modules it needs`,
          `- Preserve all functionality`,
          ``,
          barrelOp ? `**For the barrel file (\`${barrelOp.path}\`):**\n- Keep only public API exports\n- Remove internal re-exports that consumers now access directly` : '',
        ]),
      },
    ];
  }

  // ── Import Organizer: 2 passes ────────────────────────────────

  private decomposeImportOrganizer(step: RefactorStep): PromptPass[] {
    const createOps = step.operations.filter(op => op.type === 'CREATE');
    const modifyOps = step.operations.filter(op => op.type === 'MODIFY');
    const facadeOp = createOps[0];

    return [
      {
        passNumber: 1,
        objective: 'Generate the dependency facade',
        contextSource: 'source',
        outputContract: 'Complete source code for the facade file that centralizes cross-module imports',
        content: this.buildPassPrompt(step, [
          `Create a dependency facade to centralize scattered imports.`,
          facadeOp ? `**Facade file to create:** \`${facadeOp.path}\`\n${facadeOp.description}` : '',
          facadeOp?.content ? `\n**Template:**\n\`\`\`\n${facadeOp.content}\n\`\`\`` : '',
          ``,
          `**Rules:**`,
          `- Import all cross-module dependencies in the facade`,
          `- Re-export them with clear, descriptive names`,
          `- Group imports by domain/layer`,
          `- Add JSDoc explaining the facade's purpose`,
        ]),
      },
      {
        passNumber: 2,
        objective: 'Rewire the source file to import from facade',
        contextSource: 'previous',
        outputContract: 'Updated source file with all cross-module imports replaced by facade imports',
        dependsOn: 1,
        content: this.buildPassPrompt(step, [
          `Now update the source file to import from the new facade.`,
          ``,
          `**Files to update:**`,
          ...modifyOps.map(op => `- \`${op.path}\`: ${op.description}`),
          ``,
          `**Rules:**`,
          `- Replace scattered cross-module imports with a single facade import`,
          `- Do NOT change any business logic`,
          `- Ensure all used symbols are available via the facade`,
        ]),
      },
    ];
  }

  // ── Module Grouper: 3 passes ──────────────────────────────────

  private decomposeModuleGrouper(step: RefactorStep): PromptPass[] {
    const createOps = step.operations.filter(op => op.type === 'CREATE');
    const moveOps = step.operations.filter(op => op.type === 'MOVE');

    return [
      {
        passNumber: 1,
        objective: 'Analyze file relationships and confirm grouping',
        contextSource: 'source',
        outputContract: 'JSON: { module_name, files_to_move: [{from, to}], barrel_exports: string[] }',
        content: this.buildPassPrompt(step, [
          `Analyze whether the proposed file grouping makes architectural sense.`,
          ``,
          `**Proposed moves:**`,
          ...moveOps.map(op => `- \`${op.path}\` → \`${op.newPath ?? 'TBD'}\``),
          ``,
          createOps.length > 0 ? `**New module init file:** \`${createOps[0]!.path}\`` : '',
          ``,
          `1. Verify the files share a cohesive domain responsibility`,
          `2. Check for circular dependencies between the grouped files`,
          `3. Output the confirmed grouping as JSON`,
        ]),
      },
      {
        passNumber: 2,
        objective: 'Execute the file moves and create module init',
        contextSource: 'previous',
        outputContract: 'File move instructions and new barrel/init file content',
        dependsOn: 1,
        content: this.buildPassPrompt(step, [
          `Execute the grouping confirmed in Pass 1.`,
          ``,
          `1. Move each file to its new location`,
          `2. Create the module init/barrel file with public re-exports`,
          `3. Update internal imports between the grouped files (relative paths)`,
        ]),
      },
      {
        passNumber: 3,
        objective: 'Fix all broken imports across the project',
        contextSource: 'previous',
        outputContract: 'List of all files with updated import paths',
        dependsOn: 2,
        content: this.buildPassPrompt(step, [
          `Scan the entire project for broken imports after the file moves.`,
          ``,
          `**Moved files:**`,
          ...moveOps.map(op => `- \`${op.path}\` → \`${op.newPath ?? 'TBD'}\``),
          ``,
          `**Rules:**`,
          `- Update ALL import paths that referenced the old locations`,
          `- Use the new module barrel where appropriate`,
          `- Verify no broken imports remain`,
        ]),
      },
    ];
  }

  // ── Dead Code Detector: 1 pass ────────────────────────────────

  private decomposeDeadCode(step: RefactorStep): PromptPass[] {
    const deleteOps = step.operations.filter(op => op.type === 'DELETE');

    return [
      {
        passNumber: 1,
        objective: 'Verify and remove dead code files',
        contextSource: 'source',
        outputContract: 'For each file: confirmation it is safe to delete, or reason to keep it',
        content: this.buildPassPrompt(step, [
          `Review the following files flagged as potentially dead code.`,
          ``,
          `**Files to review:**`,
          ...deleteOps.map(op => `- \`${op.path}\`: ${op.description}`),
          ``,
          `**For each file:**`,
          `1. Verify it has no incoming dependencies (grep for its name across the project)`,
          `2. Check if it's an entry point, CLI script, or config that wouldn't have imports`,
          `3. If safe to delete: confirm deletion`,
          `4. If NOT safe: explain why and mark as KEEP`,
          `5. After deletion, clean up any remaining references`,
        ]),
      },
    ];
  }

  // ── Default: single-pass wrapper ──────────────────────────────

  private defaultSinglePass(step: RefactorStep): PromptPass[] {
    return [
      {
        passNumber: 1,
        objective: step.title,
        contextSource: 'source',
        outputContract: 'Complete refactored code following the directive',
        content: step.aiPrompt ?? `Refactor according to the ${step.rule} rule: ${step.description}`,
      },
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────

  private buildPassPrompt(step: RefactorStep, lines: string[]): string {
    const header = [
      `**Rule:** ${step.rule}`,
      `**Step:** ${step.title}`,
      `**Rationale:** ${step.rationale}`,
      '',
    ];
    return [...header, ...lines.filter(l => l !== undefined)].join('\n');
  }
}
