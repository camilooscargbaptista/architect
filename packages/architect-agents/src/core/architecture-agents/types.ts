/**
 * Architecture Agent Types
 *
 * Defines the contract for all autonomous architecture agents.
 * Agents are composable units that can observe, analyze, and act
 * on architecture analysis results via the Knowledge Base and EventBus.
 *
 * @since v10.0.0 — Phase 2B
 */

export type AgentCapability =
  | 'refactor'
  | 'review'
  | 'forecast'
  | 'scaffold'
  | 'audit';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface AgentResult {
  /** Agent that produced this result */
  agentId: string;
  /** Whether the agent completed successfully */
  success: boolean;
  /** Human-readable summary */
  summary: string;
  /** Structured data (agent-specific) */
  data: Record<string, unknown>;
  /** Duration in ms */
  durationMs: number;
  /** Timestamp */
  timestamp: string;
}

export interface AgentContext {
  /** Absolute path to project root */
  projectPath: string;
  /** Whether to run in non-interactive (auto-approve) mode */
  autoMode: boolean;
  /** Optional AI provider type override */
  providerType?: string;
  /** Verbose logging */
  verbose: boolean;
}

export interface AgentMetadata {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description */
  description: string;
  /** What this agent can do */
  capabilities: AgentCapability[];
  /** Semver version */
  version: string;
}

/**
 * Abstract base interface all architecture agents must implement.
 */
export interface ArchitectureAgent {
  readonly metadata: AgentMetadata;
  readonly status: AgentStatus;

  /**
   * Execute the agent's primary task.
   * Returns a structured result with success/failure and data.
   */
  execute(context: AgentContext): Promise<AgentResult>;

  /**
   * Validate that preconditions are met before execution.
   * Returns null if valid, or an error message string.
   */
  preflight(context: AgentContext): Promise<string | null>;
}
