/**
 * Genesis From Scratch — Tests
 *
 * Tests for the full document-to-architecture pipeline:
 * RequirementsParser, BlueprintGenerator, ProjectBootstrapper.
 *
 * @since v10.0.0 — Phase 4
 */

import { RequirementsParser } from '../src/core/genesis-from-scratch/requirements-parser.js';
import { BlueprintGenerator } from '../src/core/genesis-from-scratch/blueprint-generator.js';
import { ProjectBootstrapper } from '../src/core/genesis-from-scratch/project-bootstrapper.js';
import type { ParsedRequirements, ArchitectureBlueprint } from '../src/core/genesis-from-scratch/types.js';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ── Fixtures ─────────────────────────────────────────────

const ECOMMERCE_DOC = `
# ShopFlow — E-Commerce Platform

## Overview
A modern e-commerce platform for managing products, orders, and customer accounts.
Supports payment processing via Stripe and real-time inventory tracking.

## User Roles
- Customer
- Admin
- Warehouse Manager

## Features

### Product Management
- Product catalog with categories and tags
- Product entity: name, description, price (number), category, stock (number), imageUrl
- Search and filtering by category

### Order Processing
- Shopping cart and checkout workflow
- Order entity: customerId, items, totalPrice (number), status, shippingAddress
- Payment integration with Stripe API (REST API)

### Customer Accounts
- Registration and login with JWT authentication
- Customer entity: email, name, passwordHash, address, phone
- Order history

### Inventory
- Real-time stock tracking via WebSocket
- Low-stock alerts via message queue
- Inventory entity: productId, quantity (number), warehouseId, lastUpdated

## Technical Requirements
- TypeScript with Express
- PostgreSQL database
- JWT authentication
- Must comply with PCI-DSS for payment data
- High availability and horizontal scaling needed
`;

const SIMPLE_DOC = `
Task Manager API

A simple REST API for managing tasks and to-do lists.
Users can create, update, and delete tasks.

Task: title, description, completed (boolean), dueDate
User: name, email
`;

const MINIMAL_DOC = `Build a blog with posts and comments.`;

// ── RequirementsParser ───────────────────────────────────

describe('RequirementsParser', () => {
  const parser = new RequirementsParser();

  describe('parse() — e-commerce document', () => {
    let result: ParsedRequirements;

    beforeAll(() => {
      result = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
    });

    it('should extract project name', () => {
      expect(result.projectName).toMatch(/shopflow/i);
    });

    it('should detect e-commerce domain', () => {
      expect(result.domain).toBe('e-commerce');
    });

    it('should extract entities', () => {
      const names = result.entities.map(e => e.name.toLowerCase());
      expect(names).toContain('product');
      expect(names).toContain('order');
      expect(names).toContain('customer');
    });

    it('should extract entity fields', () => {
      const product = result.entities.find(e => e.name.toLowerCase() === 'product');
      expect(product).toBeDefined();
      expect(product!.fields.length).toBeGreaterThan(0);
      const priceField = product!.fields.find(f => f.name === 'price');
      expect(priceField).toBeDefined();
      expect(priceField!.type).toBe('number');
    });

    it('should extract bounded contexts', () => {
      expect(result.boundedContexts.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract integrations', () => {
      expect(result.integrations.length).toBeGreaterThanOrEqual(1);
      const restApi = result.integrations.find(i => i.type === 'rest-api');
      expect(restApi).toBeDefined();
    });

    it('should detect JWT auth', () => {
      expect(result.nonFunctional.auth).toMatch(/jwt/i);
    });

    it('should detect PostgreSQL', () => {
      expect(result.nonFunctional.database).toMatch(/postgres/i);
    });

    it('should detect security/compliance requirements', () => {
      expect(result.nonFunctional.compliance.length).toBeGreaterThan(0);
    });

    it('should extract actors', () => {
      expect(result.actors.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect scalability needs', () => {
      expect(result.nonFunctional.scalability).toBeDefined();
    });

    it('should detect websocket integration', () => {
      const ws = result.integrations.find(i => i.type === 'websocket');
      expect(ws).toBeDefined();
    });

    it('should detect queue integration', () => {
      const queue = result.integrations.find(i => i.type === 'queue');
      expect(queue).toBeDefined();
    });
  });

  describe('parse() — simple document', () => {
    let result: ParsedRequirements;

    beforeAll(() => {
      result = parser.parse({ rawText: SIMPLE_DOC, format: 'plaintext' });
    });

    it('should extract project name', () => {
      expect(result.projectName).toBeTruthy();
    });

    it('should extract task entity', () => {
      const names = result.entities.map(e => e.name.toLowerCase());
      expect(names).toContain('task');
    });

    it('should extract user entity', () => {
      const names = result.entities.map(e => e.name.toLowerCase());
      expect(names).toContain('user');
    });

    it('should have fewer integrations than e-commerce', () => {
      expect(result.integrations.length).toBeLessThanOrEqual(2);
    });
  });

  describe('parse() — minimal document', () => {
    it('should not crash on minimal input', () => {
      const result = parser.parse({ rawText: MINIMAL_DOC, format: 'plaintext' });
      expect(result.projectName).toBeTruthy();
      expect(result.domain).toBeTruthy();
    });
  });

  describe('format detection', () => {
    it('should handle markdown format', () => {
      const result = parser.parse({ rawText: '# My Project\nDescription here', format: 'markdown' });
      expect(result.projectName).toBeTruthy();
    });

    it('should handle empty input gracefully', () => {
      const result = parser.parse({ rawText: '', format: 'plaintext' });
      expect(result.projectName).toBeTruthy();
      expect(result.boundedContexts).toBeDefined();
    });
  });
});

// ── BlueprintGenerator ───────────────────────────────────

describe('BlueprintGenerator', () => {
  const parser = new RequirementsParser();
  const generator = new BlueprintGenerator();

  describe('generate() — e-commerce', () => {
    let blueprint: ArchitectureBlueprint;

    beforeAll(() => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      blueprint = generator.generate(req);
    });

    it('should produce a valid project name', () => {
      expect(blueprint.projectName).toMatch(/^[a-z0-9-]+$/);
    });

    it('should select an architecture style', () => {
      expect(blueprint.style).toBeTruthy();
      const validStyles = ['layered-monolith', 'clean-architecture', 'hexagonal', 'modular-monolith', 'microservices', 'event-driven'];
      expect(validStyles).toContain(blueprint.style);
    });

    it('should provide style rationale', () => {
      expect(blueprint.styleRationale.length).toBeGreaterThan(10);
    });

    it('should select TypeScript stack', () => {
      expect(blueprint.stack.language).toBe('typescript');
    });

    it('should select PostgreSQL', () => {
      expect(blueprint.stack.database).toMatch(/postgres/i);
    });

    it('should define layers', () => {
      expect(blueprint.layers.length).toBeGreaterThanOrEqual(3);
      for (const layer of blueprint.layers) {
        expect(layer.name).toBeTruthy();
        expect(layer.directory).toBeTruthy();
        expect(layer.responsibility).toBeTruthy();
      }
    });

    it('should generate modules from bounded contexts', () => {
      expect(blueprint.modules.length).toBeGreaterThan(0);
      for (const mod of blueprint.modules) {
        expect(mod.name).toBeTruthy();
        expect(mod.directory).toBeTruthy();
        expect(mod.files.length).toBeGreaterThan(0);
      }
    });

    it('should include cross-cutting concerns', () => {
      expect(blueprint.crossCutting.length).toBeGreaterThanOrEqual(2);
      const types = blueprint.crossCutting.map(c => c.type);
      expect(types).toContain('error-handling');
      expect(types).toContain('logging');
    });

    it('should include auth concern (JWT detected)', () => {
      const types = blueprint.crossCutting.map(c => c.type);
      expect(types).toContain('auth');
    });

    it('should define architecture rules', () => {
      expect(blueprint.rules.length).toBeGreaterThanOrEqual(2);
      const ruleTypes = blueprint.rules.map(r => r.type);
      expect(ruleTypes).toContain('quality_gate');
    });

    it('should define dependency boundaries', () => {
      expect(blueprint.boundaries.length).toBeGreaterThan(0);
      for (const boundary of blueprint.boundaries) {
        expect(boundary.from).toBeTruthy();
        expect(boundary.to).toBeTruthy();
        expect(typeof boundary.allowed).toBe('boolean');
        expect(boundary.reason).toBeTruthy();
      }
    });

    it('should carry entities through', () => {
      expect(blueprint.entities.length).toBeGreaterThan(0);
    });
  });

  describe('generate() — simple project', () => {
    it('should handle small projects', () => {
      const req = parser.parse({ rawText: SIMPLE_DOC, format: 'plaintext' });
      const bp = generator.generate(req);
      expect(bp.style).toBeTruthy();
      expect(bp.layers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('selectStyle()', () => {
    it('should prefer layered for small projects', () => {
      const req: ParsedRequirements = {
        projectName: 'small',
        description: 'Small project',
        domain: 'general',
        boundedContexts: [{ name: 'core', description: 'Core', entities: [], responsibility: 'Main' }],
        entities: [{ name: 'Item', fields: [], relationships: [] }],
        integrations: [],
        nonFunctional: { security: [], compliance: [] },
        constraints: [],
        actors: [],
        workflows: [],
      };

      const style = generator.selectStyle(req);
      // Small project should lean toward layered or clean
      expect(['layered-monolith', 'clean-architecture', 'modular-monolith']).toContain(style.style);
    });

    it('should prefer modular-monolith for medium projects', () => {
      const req: ParsedRequirements = {
        projectName: 'medium',
        description: 'Medium project',
        domain: 'fintech',
        boundedContexts: Array.from({ length: 5 }, (_, i) => ({
          name: `ctx-${i}`, description: '', entities: [], responsibility: '',
        })),
        entities: Array.from({ length: 8 }, (_, i) => ({
          name: `Entity${i}`, fields: [], relationships: [],
        })),
        integrations: [
          { name: 'DB', type: 'database' as const, description: 'Main DB' },
          { name: 'API', type: 'rest-api' as const, description: 'External' },
        ],
        nonFunctional: { security: ['auth'], compliance: [] },
        constraints: [],
        actors: ['user', 'admin'],
        workflows: [],
      };

      const style = generator.selectStyle(req);
      expect(['modular-monolith', 'clean-architecture', 'hexagonal']).toContain(style.style);
    });
  });
});

// ── ProjectBootstrapper ──────────────────────────────────

describe('ProjectBootstrapper', () => {
  const parser = new RequirementsParser();
  const generator = new BlueprintGenerator();
  const bootstrapper = new ProjectBootstrapper();

  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'architect-genesis-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('bootstrap() — e-commerce', () => {
    it('should create project directory', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      expect(existsSync(result.projectPath)).toBe(true);
    });

    it('should create package.json', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      const pkgPath = join(result.projectPath, 'package.json');
      expect(existsSync(pkgPath)).toBe(true);

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe(bp.projectName);
      expect(pkg.dependencies).toBeDefined();
      expect(pkg.devDependencies).toBeDefined();
    });

    it('should create tsconfig.json', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      const tsconfigPath = join(result.projectPath, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);

      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('should create architect rules file', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      expect(existsSync(result.rulesFile)).toBe(true);
      const rulesContent = readFileSync(result.rulesFile, 'utf-8');
      expect(rulesContent).toContain('quality_gates');
    });

    it('should create architect config file', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      expect(existsSync(result.configFile)).toBe(true);
      const config = JSON.parse(readFileSync(result.configFile, 'utf-8'));
      expect(config.style).toBe(bp.style);
    });

    it('should create .env.example', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      const envPath = join(result.projectPath, '.env.example');
      expect(existsSync(envPath)).toBe(true);
      const envContent = readFileSync(envPath, 'utf-8');
      expect(envContent).toContain('DATABASE_URL');
    });

    it('should create .gitignore', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      const gitignorePath = join(result.projectPath, '.gitignore');
      expect(existsSync(gitignorePath)).toBe(true);
      const content = readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('node_modules');
    });

    it('should create entry point (main.ts)', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      const mainPath = join(result.projectPath, 'src/main.ts');
      expect(existsSync(mainPath)).toBe(true);
    });

    it('should create README', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      expect(result.readmeGenerated).toBe(true);
      const readmePath = join(result.projectPath, 'README.md');
      expect(existsSync(readmePath)).toBe(true);
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toContain(bp.style);
    });

    it('should create source files for modules', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      expect(result.filesCreated).toBeGreaterThan(10);
    });

    it('should create test setup', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      const testDir = join(result.projectPath, 'tests');
      expect(existsSync(testDir)).toBe(true);
    });

    it('should report correct file counts in result', () => {
      const req = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      expect(result.filesCreated).toBeGreaterThan(0);
      expect(result.directories.length).toBeGreaterThan(0);
      expect(result.blueprint).toBe(bp);
    });
  });

  describe('bootstrap() — simple project', () => {
    it('should create a minimal project', () => {
      const req = parser.parse({ rawText: SIMPLE_DOC, format: 'plaintext' });
      const bp = generator.generate(req);
      const result = bootstrapper.bootstrap(bp, tempDir);

      expect(existsSync(result.projectPath)).toBe(true);
      expect(result.filesCreated).toBeGreaterThan(5);
    });
  });
});

// ── Full Pipeline Integration ────────────────────────────

describe('Genesis Pipeline — end-to-end', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'architect-genesis-e2e-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should produce a complete project from a markdown document', () => {
    const parser = new RequirementsParser();
    const generator = new BlueprintGenerator();
    const bootstrapper = new ProjectBootstrapper();

    const requirements = parser.parse({ rawText: ECOMMERCE_DOC, format: 'markdown' });
    const blueprint = generator.generate(requirements);
    const result = bootstrapper.bootstrap(blueprint, tempDir);

    // Verify the full chain
    expect(requirements.entities.length).toBeGreaterThan(0);
    expect(blueprint.modules.length).toBeGreaterThan(0);
    expect(result.filesCreated).toBeGreaterThan(10);

    // Verify config is valid JSON
    const config = JSON.parse(readFileSync(result.configFile, 'utf-8'));
    expect(config.projectName).toBe(blueprint.projectName);

    // Verify package.json has correct dependencies
    const pkg = JSON.parse(readFileSync(join(result.projectPath, 'package.json'), 'utf-8'));
    expect(pkg.dependencies['express']).toBeDefined();
    expect(pkg.devDependencies['typescript']).toBeDefined();
  });

  it('should produce a project from minimal input', () => {
    const parser = new RequirementsParser();
    const generator = new BlueprintGenerator();
    const bootstrapper = new ProjectBootstrapper();

    const requirements = parser.parse({ rawText: MINIMAL_DOC, format: 'plaintext' });
    const blueprint = generator.generate(requirements);
    const result = bootstrapper.bootstrap(blueprint, tempDir);

    expect(existsSync(result.projectPath)).toBe(true);
    expect(result.filesCreated).toBeGreaterThan(0);
  });
});
