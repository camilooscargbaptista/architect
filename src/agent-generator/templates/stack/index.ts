import { TemplateContext } from '../../types.js';

/**
 * Stack-specific rule generators.
 * Each generates a 03-[framework].md rule file tailored to the detected stack.
 */

export function generateStackRules(ctx: TemplateContext): string | null {
  const { stack } = ctx;

  if (stack.frameworks.includes('NestJS')) return generateNestJSRules(ctx);
  if (stack.frameworks.includes('Angular')) return generateAngularRules(ctx);
  if (stack.frameworks.includes('Next.js')) return generateNextJSRules(ctx);
  if (stack.frameworks.includes('Django') || stack.frameworks.includes('FastAPI')) return generatePythonWebRules(ctx);
  if (stack.frameworks.includes('Flutter')) return generateFlutterRules(ctx);
  if (stack.frameworks.includes('Spring')) return generateSpringRules(ctx);
  if (stack.frameworks.includes('Express') || stack.frameworks.includes('Fastify')) return generateNodeAPIRules(ctx);

  return null; // No framework-specific rules needed
}

export function getStackRuleFileName(ctx: TemplateContext): string | null {
  const { stack } = ctx;
  if (stack.frameworks.includes('NestJS')) return '03-nestjs';
  if (stack.frameworks.includes('Angular')) return '03-angular';
  if (stack.frameworks.includes('Next.js')) return '03-nextjs';
  if (stack.frameworks.includes('Django')) return '03-django';
  if (stack.frameworks.includes('FastAPI')) return '03-fastapi';
  if (stack.frameworks.includes('Flutter')) return '03-flutter';
  if (stack.frameworks.includes('Spring')) return '03-spring';
  if (stack.frameworks.includes('Express')) return '03-express';
  if (stack.frameworks.includes('Fastify')) return '03-fastify';
  return null;
}

// ────────────────────────────────────────────────────
// NestJS
// ────────────────────────────────────────────────────

function generateNestJSRules(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*.ts']
  description: 'Regras NestJS para ${projectName}'
  priority: HIGH
---

# ⚙️ Regras NestJS — ${projectName}

> **Padrões obrigatórios para desenvolvimento NestJS.**

---

## 📦 Estrutura de Módulo

\`\`\`
Cada feature = 1 módulo NestJS

src/modules/[feature]/
├── [feature].module.ts           → @Module({ imports, providers, exports })
├── [feature].controller.ts       → @Controller() — HTTP endpoints
├── [feature].controller.spec.ts  → Testes do controller
├── [feature].service.ts          → @Injectable() — Lógica de negócio
├── [feature].service.spec.ts     → Testes do service
├── dto/
│   ├── create-[feature].dto.ts   → class-validator + class-transformer
│   ├── update-[feature].dto.ts   → Partial<CreateDto>
│   └── [feature]-response.dto.ts → Response shape (NUNCA entity direta)
├── entities/
│   └── [feature].entity.ts       → @Entity() TypeORM / Prisma model
├── guards/                        → Guards específicos
├── pipes/                         → Pipes customizados
└── interfaces/                    → Interfaces do módulo
\`\`\`

---

## 🎯 Decorators — Uso Correto

\`\`\`
@Controller()  → Routing APENAS. Sem lógica de negócio.
@Injectable()  → Services, Repositories. Injetáveis.
@Module()      → Agrupa components. Declara imports/exports.
@Entity()      → Modelo de banco. NUNCA expor na API.

Guards:
  @UseGuards(AuthGuard)     → Autenticação
  @UseGuards(RolesGuard)    → Autorização
  @Roles('admin', 'user')   → Roles necessárias

Pipes:
  @UsePipes(ValidationPipe) → Validação de DTO
  { whitelist: true, forbidNonWhitelisted: true, transform: true }

Interceptors:
  @UseInterceptors(LoggingInterceptor)     → Logging
  @UseInterceptors(TransformInterceptor)   → Response shape
\`\`\`

---

## 🚫 Anti-Patterns NestJS

\`\`\`
❌ PROIBIDO: Lógica de negócio no controller
   → Mover para service

❌ PROIBIDO: Entity como response de API
   → Criar DTO de response

❌ PROIBIDO: @Body() sem DTO validado
   → Criar DTO com class-validator

❌ PROIBIDO: Service importando Request/Response
   → Service recebe dados puros, controller adapta

❌ PROIBIDO: Circular module imports
   → Usar forwardRef() ou extrair shared module

❌ PROIBIDO: Repository no controller
   → Controller → Service → Repository

❌ PROIBIDO: try/catch genérico no controller
   → Usar exception filters

❌ PROIBIDO: console.log
   → Usar @nestjs/common Logger ou winston
\`\`\`

---

## ✅ Patterns NestJS Obrigatórios

\`\`\`
✅ Global validation pipe no bootstrap
✅ Global exception filter (HttpExceptionFilter)
✅ DTOs com class-validator para TODOS os endpoints
✅ Config via @nestjs/config + .env
✅ Database via TypeORM/Prisma com migrations
✅ Auth via Passport + JWT strategy
✅ Swagger via @nestjs/swagger + ApiProperty()
✅ Health check endpoint (/health)
✅ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

## 📋 Checklist por Endpoint

\`\`\`
□ DTO de request com validação
□ DTO de response (não entity)
□ Guard de auth aplicado
□ Swagger decorators (@ApiTags, @ApiOperation, @ApiResponse)
□ Error handling (HttpException com status correto)
□ Teste unitário do service method
□ Teste de integração do endpoint
□ Logging estruturado
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

// ────────────────────────────────────────────────────
// Angular
// ────────────────────────────────────────────────────

function generateAngularRules(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*.ts', '**/*.html', '**/*.scss']
  description: 'Regras Angular para ${projectName}'
  priority: HIGH
---

# 🅰️ Regras Angular — ${projectName}

> **Padrões obrigatórios para desenvolvimento Angular.**

---

## 📦 Estrutura de Module

\`\`\`
src/app/modules/[feature]/
├── [feature].module.ts
├── [feature]-routing.module.ts
├── components/
│   ├── [feature]-list/
│   │   ├── [feature]-list.component.ts
│   │   ├── [feature]-list.component.html
│   │   ├── [feature]-list.component.scss
│   │   └── [feature]-list.component.spec.ts
│   └── [feature]-form/
│       └── ...
├── services/
│   ├── [feature].service.ts
│   └── [feature].service.spec.ts
├── models/
│   └── [feature].model.ts
├── guards/
└── pipes/
\`\`\`

---

## 🎯 Component Rules

\`\`\`
□ Smart vs Dumb components (Container vs Presentational)
□ OnPush change detection por padrão
□ Unsubscribe de Observables (takeUntilDestroyed ou async pipe)
□ TODOS os estados: loading, error, empty, data
□ Lazy loading para feature modules
□ trackBy em *ngFor
□ Sem lógica de negócio no template
□ Sem lógica de negócio no component — usar services
\`\`\`

---

## 🚫 Anti-Patterns Angular

\`\`\`
❌ Component com > 200 linhas de lógica → Extrair para service
❌ Subscribe manual sem unsubscribe → Memory leak
❌ Chamadas HTTP no component → Usar service
❌ any em templates → Tipar corretamente
❌ Shared module gigante → Dividir por domínio
\`\`\`

---

## ✅ Checklist por Component

\`\`\`
□ OnPush change detection
□ Loading/error/empty states
□ Responsive (mobile + desktop)
□ Acessibilidade (labels, aria)
□ Lazy loaded (se feature module)
□ Teste unitário
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

// ────────────────────────────────────────────────────
// Next.js
// ────────────────────────────────────────────────────

function generateNextJSRules(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*.{ts,tsx,js,jsx}']
  description: 'Regras Next.js para ${projectName}'
  priority: HIGH
---

# ▲ Regras Next.js — ${projectName}

> **Padrões obrigatórios para desenvolvimento Next.js.**

---

## 📦 Estrutura

\`\`\`
src/
├── app/                    → App Router (pages, layouts, loading, error)
│   ├── layout.tsx          → Root layout
│   ├── page.tsx            → Home
│   ├── [feature]/
│   │   ├── page.tsx        → Feature page (Server Component por padrão)
│   │   ├── loading.tsx     → Loading UI
│   │   ├── error.tsx       → Error boundary
│   │   └── layout.tsx      → Feature layout
├── components/             → Shared components
│   ├── ui/                 → Design system atoms
│   └── [feature]/          → Feature-specific components
├── lib/                    → Utilities, API clients
├── services/               → Business logic, data fetching
├── types/                  → TypeScript types
└── hooks/                  → Custom React hooks
\`\`\`

---

## 🎯 Server vs Client Components

\`\`\`
Server Components (padrão):
  ✅ Data fetching
  ✅ Acesso a backend resources
  ✅ Sensitive data (tokens, keys)
  ✅ Large dependencies server-side

Client Components ('use client'):
  ✅ Interatividade (onClick, onChange)
  ✅ Hooks (useState, useEffect)
  ✅ Browser APIs
  ✅ Event listeners

REGRA: Manter Client Components o menor possível.
       Push 'use client' para baixo na árvore.
\`\`\`

---

## 🚫 Anti-Patterns Next.js

\`\`\`
❌ 'use client' no layout.tsx → Quebra streaming SSR
❌ fetch sem cache strategy → Definir revalidate
❌ useEffect para data fetching → Server Component
❌ API route sem validação → Zod schema
❌ Client component gigante → Extrair server parts
\`\`\`

---

## ✅ Checklist por Page

\`\`\`
□ loading.tsx para Suspense boundary
□ error.tsx para error boundary
□ Metadata (generateMetadata) para SEO
□ Server Component por padrão
□ Validação de params/searchParams
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

// ────────────────────────────────────────────────────
// Python Web (Django / FastAPI)
// ────────────────────────────────────────────────────

function generatePythonWebRules(ctx: TemplateContext): string {
  const { projectName, stack, config } = ctx;
  const fw = stack.frameworks.includes('Django') ? 'Django' : 'FastAPI';

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*.py']
  description: 'Regras ${fw} para ${projectName}'
  priority: HIGH
---

# 🐍 Regras ${fw} — ${projectName}

> **Padrões obrigatórios para desenvolvimento ${fw}.**

---

## 📦 Estrutura

${fw === 'Django' ? `\`\`\`
apps/[feature]/
├── __init__.py
├── admin.py              → Admin customizado
├── apps.py               → App config
├── models.py             → Models (ORM)
├── managers.py           → Custom QuerySet/Manager
├── serializers.py        → DRF Serializers
├── views.py              → ViewSets / APIViews
├── urls.py               → URL patterns
├── permissions.py        → Custom permissions
├── filters.py            → django-filter sets
├── signals.py            → Signal handlers
├── services.py           → Business logic (NÃO no view)
├── tasks.py              → Celery tasks
├── tests/
│   ├── test_models.py
│   ├── test_views.py
│   └── test_services.py
└── migrations/
\`\`\`` : `\`\`\`
app/
├── main.py               → FastAPI app, middleware
├── core/
│   ├── config.py         → Pydantic Settings
│   ├── security.py       → JWT, hashing
│   └── deps.py           → Dependency injection
├── modules/[feature]/
│   ├── __init__.py
│   ├── router.py         → APIRouter endpoints
│   ├── schemas.py        → Pydantic models (request/response)
│   ├── models.py         → SQLAlchemy models
│   ├── service.py        → Business logic
│   ├── repository.py     → Data access
│   └── tests/
│       ├── test_router.py
│       └── test_service.py
└── alembic/              → Migrations
\`\`\``}

---

## 🚫 Anti-Patterns ${fw}

\`\`\`
${fw === 'Django' ? `❌ Fat views (lógica de negócio no view) → Usar services.py
❌ N+1 queries → select_related / prefetch_related
❌ Raw SQL sem necessidade → QuerySet API
❌ Model sem __str__ → Sempre implementar
❌ Migrations manuais → Sempre via makemigrations
❌ Signal abuse → Preferir chamada explícita em service` : `❌ Lógica no router (endpoint) → Usar service layer
❌ SQLAlchemy session no router → Dependency injection
❌ Schemas sem validação → Pydantic validators
❌ sync blocking em async → Usar run_in_executor
❌ Sem type hints → FastAPI depende de tipos`}
\`\`\`

---

## ✅ Checklist

\`\`\`
□ Lógica de negócio em services (não views/routers)
□ Schemas/Serializers para TODOS os endpoints
□ Migrations reversíveis
□ Testes para models, services, views
□ Type hints em todo código
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

// ────────────────────────────────────────────────────
// Flutter
// ────────────────────────────────────────────────────

function generateFlutterRules(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*.dart']
  description: 'Regras Flutter para ${projectName}'
  priority: HIGH
---

# 📱 Regras Flutter — ${projectName}

> **Padrões obrigatórios para desenvolvimento Flutter.**

---

## 📦 Estrutura

\`\`\`
lib/
├── main.dart                   → Entry point
├── app.dart                    → MaterialApp / Router
├── core/
│   ├── di/                     → Dependency injection (get_it/riverpod)
│   ├── theme/                  → AppTheme, colors, typography
│   ├── network/                → Dio/HTTP client config
│   ├── storage/                → SharedPreferences, secure storage
│   └── utils/                  → Extensions, formatters
├── features/[feature]/
│   ├── data/
│   │   ├── models/             → JSON models (fromJson/toJson)
│   │   ├── repositories/      → Repository implementation
│   │   └── datasources/       → API calls, local DB
│   ├── domain/
│   │   ├── entities/           → Business entities
│   │   ├── repositories/      → Repository interfaces (abstract)
│   │   └── usecases/          → Business logic units
│   └── presentation/
│       ├── pages/             → Screen widgets
│       ├── widgets/           → Feature-specific widgets
│       ├── bloc/ (ou cubit/)  → State management
│       └── providers/         → Riverpod providers (se usado)
└── shared/
    ├── widgets/               → Reusable widgets
    └── models/                → Shared models
\`\`\`

---

## 🎯 State Management

\`\`\`
Padrão: BLoC/Cubit ou Riverpod (escolher UM)

BLoC:
  Event → BLoC → State → UI
  □ Events são imutáveis
  □ States são imutáveis
  □ BLoC não importa Flutter (puro Dart)
  □ Um BLoC por feature (não God BLoC)

NUNCA:
  ❌ setState para lógica complexa
  ❌ State management misturado (BLoC + Provider + setState)
  ❌ BLoC acessando BuildContext
\`\`\`

---

## 🚫 Anti-Patterns Flutter

\`\`\`
❌ Column com muitos children para listas → ListView.builder
❌ Widget gigante (> 200 linhas) → Extrair sub-widgets
❌ Build method com lógica → Mover para BLoC/Cubit
❌ Sem const constructors → Sempre usar const
❌ FutureBuilder direto para API calls → BLoC/Cubit
❌ Hardcoded strings → Usar l10n/intl
❌ Hardcoded colors → Usar Theme.of(context)
\`\`\`

---

## ✅ Checklist por Screen

\`\`\`
□ TODOS os estados: loading, error, empty, data
□ Pull-to-refresh (se lista)
□ Skeleton/shimmer para loading
□ Error retry button
□ Responsive (tablet support se necessário)
□ Keyboard handling (dismiss, next field)
□ Teste de widget
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

// ────────────────────────────────────────────────────
// Spring Boot
// ────────────────────────────────────────────────────

function generateSpringRules(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*.java', '**/*.kt']
  description: 'Regras Spring Boot para ${projectName}'
  priority: HIGH
---

# 🍃 Regras Spring Boot — ${projectName}

> **Padrões obrigatórios para desenvolvimento Spring Boot.**

---

## 📦 Estrutura

\`\`\`
src/main/java/com/[org]/[project]/
├── [Feature]Module/
│   ├── controller/
│   │   └── [Feature]Controller.java     → @RestController
│   ├── service/
│   │   ├── [Feature]Service.java        → Interface
│   │   └── [Feature]ServiceImpl.java    → @Service
│   ├── repository/
│   │   └── [Feature]Repository.java     → @Repository / JPA
│   ├── dto/
│   │   ├── Create[Feature]Request.java  → @Valid annotations
│   │   └── [Feature]Response.java
│   ├── entity/
│   │   └── [Feature].java              → @Entity JPA
│   └── exception/
│       └── [Feature]NotFoundException.java
\`\`\`

---

## 🚫 Anti-Patterns Spring

\`\`\`
❌ @Autowired field injection → Constructor injection
❌ Lógica no controller → Service layer
❌ Entity como response → DTO mapping
❌ catch(Exception e) genérico → Specific exceptions + @ControllerAdvice
❌ @Transactional no controller → Service layer
\`\`\`

---

## ✅ Checklist

\`\`\`
□ Constructor injection (não field)
□ DTOs com @Valid
□ @ControllerAdvice para exception handling
□ @Transactional no service
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

// ────────────────────────────────────────────────────
// Express / Fastify (Node.js API)
// ────────────────────────────────────────────────────

function generateNodeAPIRules(ctx: TemplateContext): string {
  const { projectName, stack, config } = ctx;
  const fw = stack.frameworks.includes('Fastify') ? 'Fastify' : 'Express';

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*.{ts,js}']
  description: 'Regras ${fw} para ${projectName}'
  priority: HIGH
---

# 🚀 Regras ${fw} — ${projectName}

> **Padrões obrigatórios para desenvolvimento ${fw}.**

---

## 📦 Estrutura

\`\`\`
src/
├── app.${stack.languages.includes('TypeScript') ? 'ts' : 'js'}          → ${fw} app setup, middleware
├── server.${stack.languages.includes('TypeScript') ? 'ts' : 'js'}       → Server bootstrap
├── modules/[feature]/
│   ├── [feature].routes.${stack.languages.includes('TypeScript') ? 'ts' : 'js'}    → Route definitions
│   ├── [feature].controller.${stack.languages.includes('TypeScript') ? 'ts' : 'js'} → Request handling
│   ├── [feature].service.${stack.languages.includes('TypeScript') ? 'ts' : 'js'}    → Business logic
│   ├── [feature].schema.${stack.languages.includes('TypeScript') ? 'ts' : 'js'}     → Validation (Joi/Zod)
│   ├── [feature].model.${stack.languages.includes('TypeScript') ? 'ts' : 'js'}      → DB model
│   └── __tests__/
├── middleware/        → Auth, logging, error handler
├── config/            → Environment config
└── utils/             → Shared utilities
\`\`\`

---

## 🚫 Anti-Patterns ${fw}

\`\`\`
❌ Lógica de negócio no route handler → Usar service layer
❌ req.body sem validação → Joi/Zod schema
❌ Callback hell → async/await
❌ Error swallowing (catch vazio) → Proper error handler middleware
❌ Secrets hardcoded → Environment variables
❌ console.log em produção → Structured logger (winston/pino)
\`\`\`

---

## ✅ Checklist

\`\`\`
□ Validation middleware em TODOS os endpoints
□ Error handling middleware global
□ Auth middleware para rotas protegidas
□ Rate limiting
□ CORS configurado
□ Helmet para security headers
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}
