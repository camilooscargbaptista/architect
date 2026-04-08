/**
 * Architecture Agents — Phase 2B
 *
 * Autonomous agents for architecture review, forecasting, refactoring, and scaffolding.
 *
 * @since v10.0.0
 */

export { BaseArchitectureAgent } from './base-agent.js';
export { ReviewAgent } from './review-agent.js';
export { ForecastAgent } from './forecast-agent.js';
export { RefactorAgent } from './refactor-agent.js';
export { ScaffoldAgent } from './scaffold-agent.js';
export { AgentRegistry, agentRegistry } from './agent-registry.js';

export type {
  ArchitectureAgent,
  AgentCapability,
  AgentStatus,
  AgentResult,
  AgentContext,
  AgentMetadata,
} from './types.js';
