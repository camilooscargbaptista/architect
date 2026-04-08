/**
 * Base Architecture Agent
 *
 * Provides lifecycle hooks, logging, and timing for all agents.
 *
 * @since v10.0.0 — Phase 2B
 */

import type {
  ArchitectureAgent,
  AgentMetadata,
  AgentStatus,
  AgentContext,
  AgentResult,
} from './types.js';

export abstract class BaseArchitectureAgent implements ArchitectureAgent {
  abstract readonly metadata: AgentMetadata;
  private _status: AgentStatus = 'idle';

  get status(): AgentStatus {
    return this._status;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    this._status = 'running';

    try {
      const preflightError = await this.preflight(context);
      if (preflightError) {
        this._status = 'failed';
        return {
          agentId: this.metadata.id,
          success: false,
          summary: `Preflight failed: ${preflightError}`,
          data: {},
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      if (context.verbose) {
        this.log(`Starting ${this.metadata.name}...`);
      }

      const result = await this.run(context);
      this._status = result.success ? 'completed' : 'failed';

      if (context.verbose) {
        this.log(`${result.success ? '✓' : '✗'} ${result.summary} (${result.durationMs}ms)`);
      }

      return result;
    } catch (err: unknown) {
      this._status = 'failed';
      const message = err instanceof Error ? err.message : String(err);
      return {
        agentId: this.metadata.id,
        success: false,
        summary: `Agent crashed: ${message}`,
        data: { error: message },
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
  }

  abstract preflight(context: AgentContext): Promise<string | null>;

  /**
   * Core implementation — subclasses override this.
   */
  protected abstract run(context: AgentContext): Promise<AgentResult>;

  protected log(message: string): void {
    console.error(`[${this.metadata.id}] ${message}`);
  }
}
