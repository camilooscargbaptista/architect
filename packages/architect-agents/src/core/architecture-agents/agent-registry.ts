/**
 * Agent Registry
 *
 * Central registry for discovering and instantiating architecture agents.
 * Supports agent lookup by ID or capability.
 *
 * @since v10.0.0 — Phase 2B
 */

import type { ArchitectureAgent, AgentCapability, AgentContext, AgentResult } from './types.js';
import { ReviewAgent } from './review-agent.js';
import { ForecastAgent } from './forecast-agent.js';
import { RefactorAgent } from './refactor-agent.js';
import { ScaffoldAgent } from './scaffold-agent.js';

export class AgentRegistry {
  private agents = new Map<string, ArchitectureAgent>();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Register a custom agent.
   */
  register(agent: ArchitectureAgent): void {
    this.agents.set(agent.metadata.id, agent);
  }

  /**
   * Get agent by ID.
   */
  get(id: string): ArchitectureAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Find all agents with a given capability.
   */
  findByCapability(capability: AgentCapability): ArchitectureAgent[] {
    return Array.from(this.agents.values()).filter(
      a => a.metadata.capabilities.includes(capability)
    );
  }

  /**
   * List all registered agents.
   */
  list(): ArchitectureAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Execute an agent by ID.
   */
  async execute(agentId: string, context: AgentContext): Promise<AgentResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        agentId,
        success: false,
        summary: `Agent "${agentId}" not found. Available: ${Array.from(this.agents.keys()).join(', ')}`,
        data: {},
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }
    return agent.execute(context);
  }

  /**
   * Execute all agents matching a capability, in sequence.
   */
  async executeByCapability(
    capability: AgentCapability,
    context: AgentContext
  ): Promise<AgentResult[]> {
    const agents = this.findByCapability(capability);
    const results: AgentResult[] = [];
    for (const agent of agents) {
      results.push(await agent.execute(context));
    }
    return results;
  }

  private registerDefaults(): void {
    this.register(new ReviewAgent());
    this.register(new ForecastAgent());
    this.register(new RefactorAgent());
    this.register(new ScaffoldAgent());
  }
}

/** Global singleton registry */
export const agentRegistry = new AgentRegistry();
