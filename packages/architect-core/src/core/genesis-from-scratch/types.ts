/**
 * Genesis From Scratch — Types
 *
 * Complete type system for the document-to-architecture pipeline.
 *
 * @since v10.0.0 — Phase 4
 */

// ── Requirements ──────────────────────────────────────────

export interface RequirementsDocument {
  /** Raw text content of the input document */
  rawText: string;
  /** Detected document format */
  format: 'markdown' | 'plaintext' | 'yaml' | 'json';
  /** Source file path (if from file) */
  sourcePath?: string;
}

export interface ParsedRequirements {
  /** Project name extracted or inferred */
  projectName: string;
  /** High-level description */
  description: string;
  /** Domain/industry (e.g., 'fintech', 'e-commerce', 'healthcare') */
  domain: string;
  /** Detected bounded contexts / feature areas */
  boundedContexts: BoundedContext[];
  /** Entities / data models mentioned */
  entities: Entity[];
  /** Integration points (APIs, databases, external services) */
  integrations: Integration[];
  /** Non-functional requirements */
  nonFunctional: NonFunctionalRequirements;
  /** Technical constraints mentioned */
  constraints: string[];
  /** User roles / actors */
  actors: string[];
  /** Key workflows / use cases */
  workflows: Workflow[];
}

export interface BoundedContext {
  name: string;
  description: string;
  entities: string[];
  /** Inferred responsibility */
  responsibility: string;
}

export interface Entity {
  name: string;
  fields: EntityField[];
  relationships: EntityRelationship[];
}

export interface EntityField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface EntityRelationship {
  target: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  description?: string;
}

export interface Integration {
  name: string;
  type: 'rest-api' | 'graphql' | 'grpc' | 'database' | 'queue' | 'external-service' | 'websocket';
  description: string;
}

export interface NonFunctionalRequirements {
  /** Target language/stack if specified */
  preferredStack?: string;
  /** Authentication method */
  auth?: string;
  /** Database preference */
  database?: string;
  /** Scalability requirements */
  scalability?: string;
  /** Performance targets */
  performance?: string;
  /** Security requirements */
  security: string[];
  /** Compliance requirements */
  compliance: string[];
}

export interface Workflow {
  name: string;
  description: string;
  steps: string[];
  actors: string[];
}

// ── Blueprint ─────────────────────────────────────────────

export type ArchitectureStyle =
  | 'layered-monolith'
  | 'clean-architecture'
  | 'hexagonal'
  | 'microservices'
  | 'modular-monolith'
  | 'serverless'
  | 'event-driven';

export interface ArchitectureBlueprint {
  /** Project metadata */
  projectName: string;
  description: string;
  /** Chosen architecture style */
  style: ArchitectureStyle;
  /** Rationale for the chosen style */
  styleRationale: string;
  /** Technology stack decisions */
  stack: StackDecision;
  /** Layer definitions */
  layers: LayerDefinition[];
  /** Module definitions (bounded context → module) */
  modules: ModuleDefinition[];
  /** Cross-cutting concerns */
  crossCutting: CrossCuttingConcern[];
  /** Architecture rules to enforce */
  rules: BlueprintRule[];
  /** Entity schemas */
  entities: Entity[];
  /** Dependency boundaries */
  boundaries: DependencyBoundary[];
}

export interface StackDecision {
  language: string;
  runtime: string;
  framework: string;
  database: string;
  orm?: string;
  testFramework: string;
  buildTool: string;
  packageManager: string;
  /** Additional libraries */
  libraries: Array<{ name: string; purpose: string }>;
}

export interface LayerDefinition {
  name: string;
  directory: string;
  responsibility: string;
  allowedDependencies: string[];
  /** Files that will be generated */
  files: string[];
}

export interface ModuleDefinition {
  name: string;
  directory: string;
  boundedContext: string;
  layer: string;
  description: string;
  files: ModuleFile[];
  dependencies: string[];
}

export interface ModuleFile {
  path: string;
  type: 'controller' | 'service' | 'repository' | 'entity' | 'dto' | 'interface' | 'config' | 'test' | 'index' | 'middleware' | 'event' | 'handler';
  template: string;
  description: string;
}

export interface CrossCuttingConcern {
  name: string;
  type: 'auth' | 'logging' | 'error-handling' | 'validation' | 'caching' | 'monitoring' | 'cors' | 'rate-limiting';
  directory: string;
  files: ModuleFile[];
}

export interface BlueprintRule {
  type: 'quality_gate' | 'boundary' | 'naming' | 'dependency';
  yaml: string;
  description: string;
}

export interface DependencyBoundary {
  from: string;
  to: string;
  allowed: boolean;
  reason: string;
}

// ── Bootstrapper Output ───────────────────────────────────

export interface BootstrapResult {
  projectPath: string;
  filesCreated: number;
  directories: string[];
  blueprint: ArchitectureBlueprint;
  rulesFile: string;
  configFile: string;
  readmeGenerated: boolean;
  /** Initial score after scaffold */
  initialScore?: number;
}
