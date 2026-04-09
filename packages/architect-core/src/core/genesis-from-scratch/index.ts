/**
 * Genesis From Scratch — Public API
 *
 * Document → Architecture pipeline.
 *
 * @example
 * ```ts
 * import { RequirementsParser, BlueprintGenerator, ProjectBootstrapper } from '@girardelli/architect-core';
 *
 * const parser = new RequirementsParser();
 * const generator = new BlueprintGenerator();
 * const bootstrapper = new ProjectBootstrapper();
 *
 * const requirements = parser.parse({ rawText: docContent, format: 'markdown' });
 * const blueprint = generator.generate(requirements);
 * const result = bootstrapper.bootstrap(blueprint, './output');
 * ```
 *
 * @since v10.0.0 — Phase 4
 */

export { RequirementsParser } from './requirements-parser.js';
export { BlueprintGenerator } from './blueprint-generator.js';
export { ProjectBootstrapper } from './project-bootstrapper.js';

export type {
  // Requirements
  RequirementsDocument,
  ParsedRequirements,
  BoundedContext,
  Entity,
  EntityField,
  EntityRelationship,
  Integration,
  NonFunctionalRequirements,
  Workflow,
  // Blueprint
  ArchitectureStyle,
  ArchitectureBlueprint,
  StackDecision,
  LayerDefinition,
  ModuleDefinition,
  ModuleFile,
  CrossCuttingConcern,
  BlueprintRule,
  DependencyBoundary,
  // Result
  BootstrapResult,
} from './types.js';
