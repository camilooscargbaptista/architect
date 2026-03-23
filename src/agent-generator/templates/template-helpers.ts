import { TemplateContext, EnrichedTemplateContext, FrameworkInfo } from '../types.js';

/**
 * Template Helpers v3.1 — Utilitários compartilhados por todos os templates.
 *
 * v3.1: Adicionados helpers framework-aware:
 * - frameworkBadge(): exibe framework com versão
 * - toolchainCommands(): exibe comandos detectados
 * - frameworkModuleStructure(): exibe estrutura de projeto real por framework
 * - frameworkSecurityChecklist(): checklist de segurança por framework
 * - projectStructureBadge(): exibe padrão arquitetural detectado
 */

/** Safely extract enriched context fields, returning defaults if not available */
export function getEnriched(ctx: TemplateContext): Partial<EnrichedTemplateContext> {
  if ('domain' in ctx) return ctx as EnrichedTemplateContext;
  return {};
}

/** Check if context is enriched */
export function isEnriched(ctx: TemplateContext): ctx is EnrichedTemplateContext {
  return 'domain' in ctx;
}

/**
 * Depth-based content scaling.
 */
export function depthScale<T>(
  ctx: TemplateContext,
  options: {
    small: T;
    medium: T;
    large: T;
    enterprise: T;
  },
): T {
  const enriched = getEnriched(ctx);
  const depth = (enriched.projectDepth || 'medium') as 'small' | 'medium' | 'large' | 'enterprise';
  return options[depth];
}

/**
 * Returns true if the current project depth >= the minimum required depth.
 */
export function depthAtLeast(ctx: TemplateContext, minDepth: 'small' | 'medium' | 'large' | 'enterprise'): boolean {
  const enriched = getEnriched(ctx);
  const depth = enriched.projectDepth || 'medium';
  const order = ['small', 'medium', 'large', 'enterprise'];
  return order.indexOf(depth) >= order.indexOf(minDepth);
}

/**
 * Generate cross-reference block to related agents.
 */
export function crossRef(agentId: string, ctx: TemplateContext): string {
  const { stack } = ctx;

  const agentRelations: Record<string, { id: string; name: string; when: string }[]> = {
    'backend': [
      { id: 'database-engineer', name: 'Database Engineer', when: 'Criar/alterar entities, migrations, queries' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Novo endpoint, auth flow, dados sensíveis' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — plano de testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Antes de criar novo módulo — verificar débito' },
    ],
    'frontend': [
      { id: 'backend', name: 'Backend Developer', when: 'Antes de integrar — doc de integração obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — testes e2e' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Forms, auth UI, dados sensíveis' },
    ],
    'flutter': [
      { id: 'backend', name: 'Backend Developer', when: 'Antes de integrar — doc de integração obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — testes de widget e integração' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Armazenamento local, biometria, deep links' },
    ],
    'database-engineer': [
      { id: 'backend', name: 'Backend Developer', when: 'Após migration — atualizar entities e queries' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Dados sensíveis, PII, encryption at rest' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Schema com N+1, índices faltantes' },
    ],
    'security-auditor': [
      { id: 'backend', name: 'Backend Developer', when: 'Falha de segurança em endpoint/service' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'Encryption at rest, data masking' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Testes de segurança (fuzzing, pentest)' },
    ],
    'qa-test': [
      { id: 'backend', name: 'Backend Developer', when: 'Cobertura insuficiente em services' },
      { id: 'frontend', name: 'Frontend Developer', when: 'Testes e2e falhando, componentes sem testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Testes com .skip(), mocks frágeis' },
    ],
    'tech-debt': [
      { id: 'backend', name: 'Backend Developer', when: 'Refatoração de módulo, god class' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'N+1 queries, índices, schema refactoring' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Débito de segurança (dependencies, configs)' },
    ],
    'code-review': [
      { id: 'security-auditor', name: 'Security Auditor', when: 'Review de endpoints, auth, dados sensíveis' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Verificar cobertura e qualidade dos testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Avaliar impacto em débito técnico' },
    ],
    'orchestrator': [
      { id: 'backend', name: 'Backend Developer', when: 'Features que tocam backend' },
      { id: 'frontend', name: 'Frontend Developer', when: 'Features que tocam frontend' },
      { id: 'flutter', name: 'Flutter UI Developer', when: 'Features que tocam app mobile' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'Features que tocam banco de dados' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'TODA feature — revisão obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'TODA feature — plano de testes obrigatório' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Antes de nova feature — checar débito' },
    ],
  };

  const relations = agentRelations[agentId] || [];
  const filtered = relations.filter(r => {
    if (r.id === 'frontend' && !stack.hasFrontend) return false;
    if (r.id === 'flutter' && !stack.hasMobile) return false;
    if (r.id === 'database-engineer' && !stack.hasDatabase) return false;
    return true;
  });

  if (filtered.length === 0) return '';

  return `
## 🔗 Cross-References (Agentes Relacionados)

| Agente | Quando Consultar |
|--------|-----------------|
${filtered.map(r => `| **${r.name}** | ${r.when} |`).join('\n')}

> **Regra:** Nunca implementar isoladamente. Sempre verificar se o agente relacionado precisa ser consultado.
`;
}

/**
 * Generate domain badge for agent headers.
 */
export function domainBadge(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain) return '';

  const { domain } = enriched;
  return `
> 📌 **Domínio:** ${domain.domain} · **Sub-domínio:** ${domain.subDomain} · **Confiança:** ${Math.round(domain.confidence * 100)}%
`;
}

/**
 * Generate compliance badges.
 */
export function complianceBadges(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain?.compliance?.length) return '';

  return `
### ⚖️ Compliance Obrigatório

${enriched.domain.compliance.map((c: any) => `- **${c.name}** — ${c.reason}
  - Checks: ${c.mandatoryChecks.join(', ')}`).join('\n')}
`;
}

/**
 * Generate project depth indicator for headers.
 */
export function depthIndicator(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  const depth = enriched.projectDepth || 'medium';
  const labels: Record<string, string> = {
    small: '🟢 Projeto Pequeno (< 50 arquivos)',
    medium: '🟡 Projeto Médio (50-200 arquivos)',
    large: '🟠 Projeto Grande (200-500 arquivos)',
    enterprise: '🔴 Enterprise (500+ arquivos)',
  };
  return labels[depth];
}

/**
 * Build a summary table of modules for context sections.
 */
export function modulesSummaryTable(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.modules?.length) return '';

  const maxModules = depthScale(ctx, { small: 5, medium: 10, large: 20, enterprise: 50 });
  const modules = enriched.modules.slice(0, maxModules);

  return `
| Módulo | Arquivos | Linhas | Testes | Camada |
|--------|----------|--------|--------|--------|
${modules.map((m: any) => `| ${m.name} | ${m.fileCount} | ${m.lineCount > 0 ? m.lineCount.toLocaleString() : '—'} | ${m.hasTests ? '✅' : '❌'} | ${m.layer} |`).join('\n')}
${enriched.modules.length > maxModules ? `\n> ... e mais ${enriched.modules.length - maxModules} módulos.` : ''}
`;
}

/**
 * Build integrations summary.
 */
export function integrationsSummary(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain?.integrations?.length) return '';

  return `
### Integrações Externas Detectadas

${enriched.domain.integrations.map((i: any) => `- **${i.name}** (${i.type}) — detectado em \`${i.detectedFrom}\``).join('\n')}
`;
}

// ═══════════════════════════════════════════════════════════════════════
// v3.1: FRAMEWORK-AWARE HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * v3.1: Generate framework badge with version.
 * Example: "🚀 **Framework:** FastAPI 0.104.1 · SQLAlchemy 2.0 · pytest"
 */
export function frameworkBadge(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.detectedFrameworks?.length) return '';

  const fws = enriched.detectedFrameworks
    .filter((f: any) => f.category === 'web' || f.category === 'orm')
    .map((f: any) => `**${f.name}**${f.version ? ` ${f.version}` : ''}`);

  const testFws = enriched.detectedFrameworks
    .filter((f: any) => f.category === 'test')
    .map((f: any) => f.name);

  const lintFws = enriched.detectedFrameworks
    .filter((f: any) => f.category === 'lint')
    .map((f: any) => f.name);

  const parts: string[] = [];
  if (fws.length) parts.push(fws.join(' + '));
  if (testFws.length) parts.push(`Testes: ${testFws.join(', ')}`);
  if (lintFws.length) parts.push(`Lint: ${lintFws.join(', ')}`);

  return `> 🚀 **Stack Detectada:** ${parts.join(' · ')}`;
}

/**
 * v3.1: Generate project structure badge.
 */
export function projectStructureBadge(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  const structure = enriched.projectStructure || 'unknown';

  const labels: Record<string, string> = {
    'clean-architecture': '🏛️ Clean Architecture / DDD',
    'mvc': '📐 MVC (Model-View-Controller)',
    'modular': '📦 Modular (Feature-based)',
    'flat': '📄 Flat Structure',
    'monorepo': '🏗️ Monorepo',
    'unknown': '❓ Estrutura não identificada',
  };

  return labels[structure] || labels['unknown'];
}

/**
 * v3.1: Generate toolchain commands block.
 */
export function toolchainCommands(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.toolchain) return '';

  const tc = enriched.toolchain;
  return `
## 🔧 Toolchain Detectado

\`\`\`bash
# Build
${tc.buildCmd}

# Testes
${tc.testCmd}

# Lint
${tc.lintCmd}

# Coverage
${tc.coverageCmd}

# Dev Server
${tc.runCmd}

# Instalar dependências
${tc.installCmd}
${tc.migrateCmd ? `\n# Migrations\n${tc.migrateCmd}` : ''}
\`\`\`

> **Deps file:** \`${tc.depsFile}\`
`;
}

/**
 * v3.1: Generate framework-specific module structure.
 * Shows the REAL expected project structure based on detected framework.
 */
export function frameworkModuleStructure(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  const fw = enriched.primaryFramework?.name || '';
  const structure = enriched.projectStructure || 'unknown';
  const lang = ctx.stack.primary;

  // Clean Architecture (Python, any framework)
  if (structure === 'clean-architecture') {
    if (lang === 'Python') {
      return `
\`\`\`
src/[projeto]/
├── domain/                          → Regras de negócio puras
│   ├── entities/                    → Entidades com identidade
│   ├── value_objects/               → Objetos de valor (imutáveis)
│   ├── services/                    → Serviços de domínio
│   ├── events/                      → Eventos de domínio
│   ├── enums/                       → Enumerações
│   └── exceptions/                  → Exceções customizadas
├── application/                     → Casos de uso
│   ├── services/                    → Application services
│   └── interfaces/                  → Contratos (ports)
├── infrastructure/                  → Implementações externas
│   ├── persistence/                 → Repositórios concretos
│   ├── storage/                     → MinIO, S3, filesystem
│   ├── extraction/                  → Extração de dados
│   │   ├── extractors/              → Extractors por tipo
│   │   ├── ocr/                     → OCR engine
│   │   └── guards/                  → Validadores
│   └── agents/                      → Agentes de automação
├── presentation/                    → Interface com o mundo
│   ├── api/                         → REST API
│   │   ├── routes/                  → Endpoints${fw === 'FastAPI' ? ' (FastAPI routers)' : ''}
│   │   └── dependencies/            → ${fw === 'FastAPI' ? 'FastAPI Depends()' : 'Injeção de deps'}
│   └── workers/                     → Background workers
└── tests/
    ├── unit/                        → Testes unitários
    ├── integration/                 → Testes de integração
    └── fixtures/                    → Dados de teste
\`\`\``;
    }

    // TypeScript Clean Architecture
    return `
\`\`\`
src/
├── domain/                          → Regras de negócio puras
│   ├── entities/                    → Entidades com identidade
│   ├── value-objects/               → Objetos de valor
│   ├── services/                    → Serviços de domínio
│   └── events/                      → Eventos de domínio
├── application/                     → Casos de uso
│   ├── use-cases/                   → Casos de uso
│   └── ports/                       → Interfaces (contratos)
├── infrastructure/                  → Implementações externas
│   ├── repositories/                → Repositórios concretos
│   ├── adapters/                    → Adaptadores externos
│   └── config/                      → Configuração
├── presentation/                    → Interface com o mundo
│   ├── controllers/                 → Endpoints da API
│   ├── dto/                         → Data Transfer Objects
│   └── middleware/                  → Middleware
└── tests/
\`\`\``;
  }

  // FastAPI (non-clean-arch)
  if (fw === 'FastAPI') {
    return `
\`\`\`
app/
├── main.py                          → Entrypoint (FastAPI app)
├── api/
│   ├── routes/                      → APIRouter por recurso
│   │   ├── __init__.py
│   │   ├── users.py                 → @router.get("/users")
│   │   └── items.py                 → @router.get("/items")
│   └── dependencies.py              → Depends() compartilhados
├── core/
│   ├── config.py                    → Settings (pydantic BaseSettings)
│   └── security.py                  → JWT, OAuth2
├── models/                          → SQLAlchemy / Pydantic models
├── schemas/                         → Pydantic schemas (request/response)
├── services/                        → Lógica de negócio
├── db/                              → Database session, migrations
└── tests/
    ├── conftest.py                  → Fixtures (TestClient, db session)
    ├── test_users.py
    └── test_items.py
\`\`\``;
  }

  // Django
  if (fw === 'Django' || fw === 'DRF') {
    return `
\`\`\`
project/
├── manage.py
├── config/                          → Settings, URLs, WSGI
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   └── urls.py                      → Root URL config
├── apps/
│   └── [app_name]/                  → Django app
│       ├── models.py                → Django ORM models
│       ├── views.py                 → ViewSets / APIViews
│       ├── serializers.py           → DRF serializers
│       ├── urls.py                  → App URLs
│       ├── admin.py                 → Django admin
│       ├── forms.py                 → Forms
│       ├── signals.py               → Django signals
│       └── tests/
│           ├── test_models.py
│           └── test_views.py
└── requirements/
\`\`\``;
  }

  // Flask
  if (fw === 'Flask') {
    return `
\`\`\`
app/
├── __init__.py                      → create_app() factory
├── blueprints/                      → Flask Blueprints
│   ├── auth/
│   │   ├── __init__.py              → Blueprint registration
│   │   ├── routes.py                → @bp.route()
│   │   └── models.py
│   └── api/
├── models/                          → SQLAlchemy models
├── services/                        → Lógica de negócio
├── extensions.py                    → db, migrate, login_manager
├── config.py                        → Configuração
└── tests/
\`\`\``;
  }

  // NestJS
  if (fw === 'NestJS') {
    return `
\`\`\`
src/
├── main.ts                          → Bootstrap (NestFactory)
├── app.module.ts                    → Root module
├── modules/
│   └── [module-name]/
│       ├── [name].module.ts         → @Module()
│       ├── [name].controller.ts     → @Controller() endpoints
│       ├── [name].service.ts        → @Injectable() lógica
│       ├── dto/
│       │   ├── create-[name].dto.ts → class-validator DTOs
│       │   └── update-[name].dto.ts
│       ├── entities/
│       │   └── [name].entity.ts     → TypeORM/Prisma entity
│       └── __tests__/
│           ├── [name].service.spec.ts
│           └── [name].controller.spec.ts
├── common/                          → Guards, pipes, interceptors
└── config/                          → ConfigModule
\`\`\``;
  }

  // Express
  if (fw === 'Express' || fw === 'Fastify') {
    return `
\`\`\`
src/
├── index.ts                         → Entrypoint
├── routes/                          → Route handlers
│   ├── users.router.ts
│   └── items.router.ts
├── controllers/                     → Request handlers
├── services/                        → Business logic
├── models/                          → Data models
├── middleware/                       → Auth, validation, error handler
├── config/                          → Environment config
└── tests/
\`\`\``;
  }

  // Spring Boot
  if (fw === 'Spring Boot') {
    return `
\`\`\`
src/main/java/com/company/project/
├── Application.java                 → @SpringBootApplication
├── controller/                      → @RestController
│   └── UserController.java
├── service/                         → @Service
│   └── UserService.java
├── repository/                      → @Repository (Spring Data JPA)
│   └── UserRepository.java
├── model/                           → @Entity
│   └── User.java
├── dto/                             → Request/Response DTOs
├── config/                          → @Configuration
├── exception/                       → @ControllerAdvice
└── security/                        → Spring Security config
\`\`\``;
  }

  // Laravel
  if (fw === 'Laravel') {
    return `
\`\`\`
app/
├── Http/
│   ├── Controllers/                 → Controllers
│   ├── Middleware/                   → Middleware
│   └── Requests/                    → Form Requests (validation)
├── Models/                          → Eloquent Models
├── Services/                        → Business Logic
├── Repositories/                    → Data Access
├── Providers/                       → Service Providers
├── Events/                          → Event classes
├── Listeners/                       → Event listeners
├── Policies/                        → Authorization policies
database/
├── migrations/                      → Database migrations
├── seeders/                         → Database seeders
└── factories/                       → Model factories
\`\`\``;
  }

  // Go
  if (fw === 'Gin' || fw === 'Echo' || fw === 'Fiber' || fw === 'Chi') {
    return `
\`\`\`
.
├── cmd/
│   └── server/
│       └── main.go                  → Entrypoint
├── internal/
│   ├── handler/                     → HTTP handlers
│   ├── service/                     → Business logic
│   ├── repository/                  → Data access
│   ├── model/                       → Domain models
│   ├── middleware/                   → HTTP middleware
│   └── config/                      → Configuration
├── pkg/                             → Public packages
├── go.mod
└── go.sum
\`\`\``;
  }

  // Ruby on Rails
  if (fw === 'Ruby on Rails') {
    return `
\`\`\`
app/
├── controllers/                     → ActionController
├── models/                          → ActiveRecord models
├── views/                           → ERB/HAML templates
├── services/                        → Service objects
├── jobs/                            → ActiveJob
├── mailers/                         → ActionMailer
├── serializers/                     → JSON serializers
config/
├── routes.rb                        → Route definitions
├── database.yml                     → Database config
db/
├── migrate/                         → Migrations
├── seeds.rb                         → Seed data
spec/ (ou test/)
\`\`\``;
  }

  // Generic fallback
  const ext = lang === 'Python' ? 'py' : lang === 'Go' ? 'go' : lang === 'PHP' ? 'php' : lang === 'Ruby' ? 'rb' : 'ts';
  return `
\`\`\`
src/
├── controllers/                     → Endpoints / HTTP handlers
├── services/                        → Lógica de negócio
├── models/                          → Modelos de dados
├── repositories/                    → Acesso a dados
├── dto/                             → Data Transfer Objects
├── middleware/                       → Middleware
├── config/                          → Configuração
└── tests/                           → Testes (.${ext})
\`\`\``;
}

/**
 * v3.1: Generate framework-specific security checklist.
 */
export function frameworkSecurityChecklist(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  const fw = enriched.primaryFramework?.name || '';
  const lang = ctx.stack.primary;

  if (fw === 'FastAPI') {
    return `
## Checklist Segurança — FastAPI

\`\`\`
□ Pydantic models para validação de TODOS os inputs
□ OAuth2PasswordBearer / OAuth2AuthorizationCodeBearer configurado
□ Depends() para injeção segura de autenticação
□ CORS via CORSMiddleware com origins whitelist (não usar "*")
□ Rate limiting via slowapi ou middleware customizado
□ Security headers via middleware (X-Content-Type-Options, etc.)
□ Senhas hasheadas com passlib (bcrypt/argon2)
□ JWT tokens com expiração curta + refresh token
□ HTTPS obrigatório em produção (redirect HTTP → HTTPS)
□ Logs estruturados SEM dados sensíveis (loguru/structlog)
□ SQLAlchemy com queries parametrizadas (nunca string concat)
□ Background tasks validadas contra injection
□ File uploads com validação de tipo e tamanho
□ Dependency scanning: pip-audit / safety
\`\`\``;
  }

  if (fw === 'Django' || fw === 'DRF') {
    return `
## Checklist Segurança — Django

\`\`\`
□ CSRF protection habilitado (CsrfViewMiddleware)
□ XSS protection via auto-escaping nos templates
□ SQL Injection prevenido via ORM (nunca raw SQL sem parametrize)
□ Clickjacking protection (X-Frame-Options)
□ SECURE_SSL_REDIRECT = True em produção
□ SESSION_COOKIE_SECURE = True
□ CSRF_COOKIE_SECURE = True
□ ALLOWED_HOSTS configurado corretamente
□ DEBUG = False em produção
□ SECRET_KEY rotacionado e não commitado
□ django-rest-framework permissions e throttling
□ django-cors-headers com whitelist
□ Senhas hasheadas com PBKDF2/Argon2 (PASSWORD_HASHERS)
□ Dependency scanning: pip-audit / safety
\`\`\``;
  }

  if (fw === 'Flask') {
    return `
## Checklist Segurança — Flask

\`\`\`
□ Flask-Talisman para security headers
□ Flask-CORS com origins whitelist
□ Flask-Limiter para rate limiting
□ Flask-Login / Flask-JWT-Extended para auth
□ CSRF via Flask-WTF
□ SECRET_KEY seguro e rotacionado
□ Session cookie seguro (httponly, secure, samesite)
□ SQLAlchemy com queries parametrizadas
□ Jinja2 auto-escaping habilitado
□ File uploads validados (tipo, tamanho, path traversal)
□ Dependency scanning: pip-audit / safety
\`\`\``;
  }

  if (fw === 'NestJS') {
    return `
## Checklist Segurança — NestJS

\`\`\`
□ Helmet habilitado (app.use(helmet()))
□ CORS com origins whitelist
□ Rate limiting via @nestjs/throttler
□ class-validator em TODOS os DTOs
□ Guards para autenticação/autorização
□ JWT via @nestjs/jwt com expiração curta
□ CSRF protection (se serve HTML)
□ TypeORM/Prisma com queries parametrizadas
□ Pipes de validação globais (ValidationPipe)
□ Exception filters customizados (sem stack traces em prod)
□ npm audit sem vulnerabilidades críticas
□ strict: true em tsconfig.json
\`\`\``;
  }

  if (fw === 'Express' || fw === 'Fastify') {
    return `
## Checklist Segurança — ${fw}

\`\`\`
□ Helmet.js habilitado
□ CORS configurado restritivamente
□ Rate limiting (express-rate-limit)
□ Input validation (joi / zod / express-validator)
□ JWT com expiração + refresh
□ CSRF protection (csurf)
□ Queries parametrizadas (nunca string interpolation)
□ Error handler que não vaza stack traces
□ npm audit sem vulnerabilidades críticas
□ HTTPS obrigatório
\`\`\``;
  }

  if (fw === 'Spring Boot') {
    return `
## Checklist Segurança — Spring Boot

\`\`\`
□ Spring Security configurado
□ CSRF habilitado para endpoints com estado
□ CORS via WebMvcConfigurer com whitelist
□ @Valid / @Validated em DTOs
□ BCrypt para senhas (PasswordEncoder)
□ JPA parametrizado (nunca JPQL com concat)
□ Actuator endpoints protegidos em produção
□ OAuth2/JWT via Spring Security OAuth
□ Content-Security-Policy configurado
□ Dependências: OWASP Dependency-Check
\`\`\``;
  }

  if (fw === 'Laravel') {
    return `
## Checklist Segurança — Laravel

\`\`\`
□ CSRF token em todos os forms (@csrf)
□ Eloquent parametrizado (nunca DB::raw sem bind)
□ Form Requests para validação
□ Sanctum/Passport para API auth
□ Gate/Policy para autorização
□ Encryption via Crypt facade
□ Rate limiting via RateLimiter
□ APP_DEBUG=false em produção
□ CORS via config/cors.php com whitelist
□ Composer audit sem vulnerabilidades
\`\`\``;
  }

  // Fallback by language
  if (lang === 'Python') {
    return `
## Checklist Segurança — Python

\`\`\`
□ Inputs validados (pydantic / marshmallow / WTForms)
□ Queries parametrizadas (SQLAlchemy / Django ORM)
□ CORS configurado com whitelist
□ Rate limiting implementado
□ Security headers configurados
□ Senhas hasheadas com bcrypt/argon2
□ Sem pickle para dados untrusted
□ HTTPS obrigatório em produção
□ pip-audit / safety para vulnerabilidades
□ Logging sem dados sensíveis
\`\`\``;
  }

  if (lang === 'Go') {
    return `
## Checklist Segurança — Go

\`\`\`
□ Inputs validados via validator package
□ Prepared statements para SQL
□ TLS/mTLS para comunicação inter-serviços
□ CORS headers explícitos
□ Rate limiting implementado
□ Logging de ações críticas (sem PII)
□ go vet / staticcheck no CI
□ govulncheck para vulnerabilidades
\`\`\``;
  }

  return `
## Checklist Segurança — ${lang}

\`\`\`
□ Inputs sanitizados e validados
□ Queries parametrizadas obrigatoriamente
□ CSRF tokens em formulários
□ Rate limiting em APIs
□ Secrets em variáveis de ambiente
□ HTTPS obrigatório em produção
□ Dependency scanning no CI
\`\`\``;
}
