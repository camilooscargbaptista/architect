/**
 * Shared test helpers for rule test suites.
 * Provides fluent builders for AnalysisReport and dependency graphs.
 */
import { AnalysisReport, DependencyEdge } from '../../src/core/types/core.js';

// ── Report Builder ───────────────────────────────────────────────────

export class ReportBuilder {
  private _nodes: string[] = [];
  private _edges: DependencyEdge[] = [];
  private _language: string = 'typescript';
  private _name: string = 'TestProject';
  private _score = { modularity: 70, coupling: 65, cohesion: 75, layering: 70 };

  static create(): ReportBuilder {
    return new ReportBuilder();
  }

  language(lang: string): this {
    this._language = lang;
    return this;
  }

  name(n: string): this {
    this._name = n;
    return this;
  }

  score(s: Partial<typeof this._score>): this {
    this._score = { ...this._score, ...s };
    return this;
  }

  addNode(node: string): this {
    if (!this._nodes.includes(node)) this._nodes.push(node);
    return this;
  }

  addNodes(...nodes: string[]): this {
    for (const n of nodes) this.addNode(n);
    return this;
  }

  addEdge(from: string, to: string, type: DependencyEdge['type'] = 'import'): this {
    this.addNode(from);
    this.addNode(to);
    this._edges.push({ from, to, type, weight: 1 });
    return this;
  }

  /**
   * Create a hub: many files → one target.
   */
  addHub(hub: string, dependents: string[]): this {
    this.addNode(hub);
    for (const dep of dependents) {
      this.addEdge(dep, hub);
    }
    return this;
  }

  /**
   * Create a fan-out: one file → many targets (cross-boundary).
   */
  addFanOut(source: string, targets: string[]): this {
    this.addNode(source);
    for (const t of targets) {
      this.addEdge(source, t);
    }
    return this;
  }

  /**
   * Create co-import pattern: multiple sources all import the same targets.
   */
  addCoImport(sources: string[], targets: string[]): this {
    for (const s of sources) {
      for (const t of targets) {
        this.addEdge(s, t);
      }
    }
    return this;
  }

  build(): AnalysisReport {
    return {
      timestamp: new Date().toISOString(),
      projectInfo: {
        path: '.',
        name: this._name,
        frameworks: [],
        primaryLanguages: [this._language],
        totalFiles: this._nodes.length,
        totalLines: this._nodes.length * 100,
      },
      score: {
        overall: Math.round(
          this._score.modularity * 0.4 + this._score.coupling * 0.25 +
          this._score.cohesion * 0.2 + this._score.layering * 0.15,
        ),
        components: [],
        breakdown: this._score,
      },
      antiPatterns: [],
      layers: [],
      dependencyGraph: {
        nodes: [...this._nodes],
        edges: [...this._edges],
      },
      suggestions: [],
      diagram: { mermaid: '', type: 'component' },
    };
  }
}

// ── Predefined Fixture Graphs ────────────────────────────────────────

export function typescriptExpressGraph(): AnalysisReport {
  return ReportBuilder.create()
    .language('typescript')
    .name('express-api')
    // Internal files
    .addNodes(
      'src/app.ts', 'src/server.ts',
      'src/routes/users.ts', 'src/routes/orders.ts', 'src/routes/products.ts',
      'src/controllers/user.controller.ts', 'src/controllers/order.controller.ts',
      'src/services/user.service.ts', 'src/services/order.service.ts',
      'src/repos/user.repo.ts', 'src/repos/order.repo.ts',
      'src/shared/database.ts', 'src/shared/logger.ts', 'src/shared/config.ts',
      'src/middleware/auth.ts', 'src/middleware/validation.ts',
    )
    // External deps (should be filtered)
    .addNodes('fs', 'path', 'crypto', 'express', 'lodash', '@prisma/client')
    // Internal edges
    .addEdge('src/app.ts', 'src/routes/users.ts')
    .addEdge('src/app.ts', 'src/routes/orders.ts')
    .addEdge('src/app.ts', 'src/routes/products.ts')
    .addEdge('src/routes/users.ts', 'src/controllers/user.controller.ts')
    .addEdge('src/routes/orders.ts', 'src/controllers/order.controller.ts')
    .addEdge('src/controllers/user.controller.ts', 'src/services/user.service.ts')
    .addEdge('src/controllers/order.controller.ts', 'src/services/order.service.ts')
    .addEdge('src/services/user.service.ts', 'src/repos/user.repo.ts')
    .addEdge('src/services/order.service.ts', 'src/repos/order.repo.ts')
    .addEdge('src/repos/user.repo.ts', 'src/shared/database.ts')
    .addEdge('src/repos/order.repo.ts', 'src/shared/database.ts')
    // External edges (should be filtered)
    .addEdge('src/app.ts', 'express')
    .addEdge('src/services/user.service.ts', 'crypto')
    .addEdge('src/shared/config.ts', 'fs')
    .addEdge('src/shared/config.ts', 'path')
    .addEdge('src/repos/user.repo.ts', '@prisma/client')
    .build();
}

export function pythonFlaskGraph(): AnalysisReport {
  return ReportBuilder.create()
    .language('python')
    .name('flask-api')
    .addNodes(
      'app/__init__.py', 'app/routes.py', 'app/models.py',
      'app/services/user_service.py', 'app/services/auth_service.py',
      'app/repos/user_repo.py', 'app/utils/helpers.py',
    )
    .addNodes('os', 'sys', 'json', 'datetime', 'flask', 'sqlalchemy')
    .addEdge('app/routes.py', 'app/services/user_service.py')
    .addEdge('app/routes.py', 'app/services/auth_service.py')
    .addEdge('app/services/user_service.py', 'app/repos/user_repo.py')
    .addEdge('app/services/user_service.py', 'app/utils/helpers.py')
    .addEdge('app/repos/user_repo.py', 'app/models.py')
    // External
    .addEdge('app/routes.py', 'flask')
    .addEdge('app/models.py', 'sqlalchemy')
    .addEdge('app/utils/helpers.py', 'os')
    .addEdge('app/utils/helpers.py', 'json')
    .build();
}

export function goMicroserviceGraph(): AnalysisReport {
  return ReportBuilder.create()
    .language('go')
    .name('user-service')
    .addNodes(
      'cmd/server/main.go', 'internal/handler/user.go', 'internal/handler/health.go',
      'internal/service/user.go', 'internal/repo/user.go',
      'internal/model/user.go', 'pkg/config/config.go',
    )
    .addNodes('fmt', 'net/http', 'encoding/json', 'context', 'github.com/gin-gonic/gin')
    .addEdge('cmd/server/main.go', 'internal/handler/user.go')
    .addEdge('cmd/server/main.go', 'internal/handler/health.go')
    .addEdge('internal/handler/user.go', 'internal/service/user.go')
    .addEdge('internal/service/user.go', 'internal/repo/user.go')
    .addEdge('internal/repo/user.go', 'internal/model/user.go')
    // External
    .addEdge('cmd/server/main.go', 'fmt')
    .addEdge('internal/handler/user.go', 'net/http')
    .addEdge('internal/handler/user.go', 'encoding/json')
    .addEdge('cmd/server/main.go', 'github.com/gin-gonic/gin')
    .build();
}
