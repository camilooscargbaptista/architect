import {
  ReviewAgent,
  ForecastAgent,
  RefactorAgent,
  ScaffoldAgent,
  AgentRegistry,
  agentRegistry,
  BaseArchitectureAgent,
} from '../src/core/architecture-agents/index.js';
import type { AgentContext, AgentResult, AgentMetadata } from '../src/core/architecture-agents/types.js';

// ── Test helpers ─────────────────────────────────────────

class TestAgent extends BaseArchitectureAgent {
  readonly metadata: AgentMetadata = {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent for unit testing',
    capabilities: ['audit'],
    version: '1.0.0',
  };

  shouldFail = false;
  shouldCrash = false;
  preflightError: string | null = null;

  async preflight(_context: AgentContext): Promise<string | null> {
    return this.preflightError;
  }

  protected async run(_context: AgentContext): Promise<AgentResult> {
    if (this.shouldCrash) throw new Error('Intentional crash');
    return {
      agentId: this.metadata.id,
      success: !this.shouldFail,
      summary: this.shouldFail ? 'Failed on purpose' : 'Test completed',
      data: { ran: true },
      durationMs: 1,
      timestamp: new Date().toISOString(),
    };
  }
}

const makeContext = (overrides?: Partial<AgentContext>): AgentContext => ({
  projectPath: '/nonexistent/path',
  autoMode: false,
  verbose: false,
  ...overrides,
});

// ── BaseArchitectureAgent ────────────────────────────────

describe('BaseArchitectureAgent', () => {
  it('should start in idle status', () => {
    const agent = new TestAgent();
    expect(agent.status).toBe('idle');
  });

  it('should transition to completed on success', async () => {
    const agent = new TestAgent();
    const result = await agent.execute(makeContext());
    expect(result.success).toBe(true);
    expect(agent.status).toBe('completed');
  });

  it('should transition to failed on failure', async () => {
    const agent = new TestAgent();
    agent.shouldFail = true;
    const result = await agent.execute(makeContext());
    expect(result.success).toBe(false);
    expect(agent.status).toBe('failed');
  });

  it('should catch crashes and return error result', async () => {
    const agent = new TestAgent();
    agent.shouldCrash = true;
    const result = await agent.execute(makeContext());
    expect(result.success).toBe(false);
    expect(result.summary).toContain('Intentional crash');
    expect(agent.status).toBe('failed');
  });

  it('should fail on preflight error without running', async () => {
    const agent = new TestAgent();
    agent.preflightError = 'Bad config';
    const result = await agent.execute(makeContext());
    expect(result.success).toBe(false);
    expect(result.summary).toContain('Preflight failed');
    expect(result.summary).toContain('Bad config');
  });

  it('should include timing in results', async () => {
    const agent = new TestAgent();
    const result = await agent.execute(makeContext());
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
  });

  it('should log when verbose', async () => {
    const agent = new TestAgent();
    const logs: string[] = [];
    const original = console.error;
    console.error = (...args: any[]) => { logs.push(args.join(' ')); };
    await agent.execute(makeContext({ verbose: true }));
    console.error = original;
    expect(logs.some(l => l.includes('[test-agent]'))).toBe(true);
  });
});

// ── AgentRegistry ────────────────────────────────────────

describe('AgentRegistry', () => {
  it('should register default agents', () => {
    const registry = new AgentRegistry();
    const agents = registry.list();
    expect(agents.length).toBeGreaterThanOrEqual(4);
    expect(registry.get('review-agent')).toBeDefined();
    expect(registry.get('forecast-agent')).toBeDefined();
    expect(registry.get('refactor-agent')).toBeDefined();
    expect(registry.get('scaffold-agent')).toBeDefined();
  });

  it('should register custom agents', () => {
    const registry = new AgentRegistry();
    const custom = new TestAgent();
    registry.register(custom);
    expect(registry.get('test-agent')).toBe(custom);
  });

  it('should find agents by capability', () => {
    const registry = new AgentRegistry();
    const reviewAgents = registry.findByCapability('review');
    expect(reviewAgents.length).toBe(1);
    expect(reviewAgents[0]!.metadata.id).toBe('review-agent');
  });

  it('should find refactor agents', () => {
    const registry = new AgentRegistry();
    const agents = registry.findByCapability('refactor');
    expect(agents.length).toBe(1);
    expect(agents[0]!.metadata.id).toBe('refactor-agent');
  });

  it('should find forecast agents', () => {
    const registry = new AgentRegistry();
    const agents = registry.findByCapability('forecast');
    expect(agents.length).toBe(1);
  });

  it('should find scaffold agents', () => {
    const registry = new AgentRegistry();
    const agents = registry.findByCapability('scaffold');
    expect(agents.length).toBe(1);
  });

  it('should return error for unknown agent ID', async () => {
    const registry = new AgentRegistry();
    const result = await registry.execute('nonexistent', makeContext());
    expect(result.success).toBe(false);
    expect(result.summary).toContain('not found');
  });

  it('should execute by capability', async () => {
    const registry = new AgentRegistry();
    const custom = new TestAgent();
    registry.register(custom);
    const results = await registry.executeByCapability('audit', makeContext());
    expect(results.length).toBeGreaterThanOrEqual(1);
    const testResult = results.find(r => r.agentId === 'test-agent');
    expect(testResult).toBeDefined();
    expect(testResult!.success).toBe(true);
  });

  it('agentRegistry should be a singleton', () => {
    expect(agentRegistry).toBeInstanceOf(AgentRegistry);
    expect(agentRegistry.list().length).toBeGreaterThanOrEqual(4);
  });
});

// ── Agent metadata ───────────────────────────────────────

describe('Agent Metadata', () => {
  it('ReviewAgent has correct metadata', () => {
    const agent = new ReviewAgent();
    expect(agent.metadata.id).toBe('review-agent');
    expect(agent.metadata.capabilities).toContain('review');
    expect(agent.metadata.capabilities).toContain('audit');
    expect(agent.metadata.version).toBe('10.0.0');
  });

  it('ForecastAgent has correct metadata', () => {
    const agent = new ForecastAgent();
    expect(agent.metadata.id).toBe('forecast-agent');
    expect(agent.metadata.capabilities).toContain('forecast');
  });

  it('RefactorAgent has correct metadata', () => {
    const agent = new RefactorAgent();
    expect(agent.metadata.id).toBe('refactor-agent');
    expect(agent.metadata.capabilities).toContain('refactor');
  });

  it('ScaffoldAgent has correct metadata', () => {
    const agent = new ScaffoldAgent();
    expect(agent.metadata.id).toBe('scaffold-agent');
    expect(agent.metadata.capabilities).toContain('scaffold');
  });
});

// ── Preflight checks ─────────────────────────────────────

describe('Agent Preflight', () => {
  it('ReviewAgent rejects nonexistent path', async () => {
    const agent = new ReviewAgent();
    const err = await agent.preflight(makeContext());
    expect(err).toContain('does not exist');
  });

  it('ForecastAgent rejects nonexistent path', async () => {
    const agent = new ForecastAgent();
    const err = await agent.preflight(makeContext());
    expect(err).toContain('does not exist');
  });

  it('RefactorAgent rejects nonexistent path', async () => {
    const agent = new RefactorAgent();
    const err = await agent.preflight(makeContext());
    expect(err).toContain('does not exist');
  });

  it('ScaffoldAgent rejects nonexistent path', async () => {
    const agent = new ScaffoldAgent();
    const err = await agent.preflight(makeContext());
    expect(err).toContain('does not exist');
  });
});

// ── ScaffoldAgent constructor ────────────────────────────

describe('ScaffoldAgent', () => {
  it('should accept custom module name', () => {
    const agent = new ScaffoldAgent('my-feature');
    expect(agent.metadata.id).toBe('scaffold-agent');
  });

  it('should use default module name', () => {
    const agent = new ScaffoldAgent();
    expect(agent.metadata.id).toBe('scaffold-agent');
  });
});
