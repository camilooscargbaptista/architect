    // @ts-ignore - Audit cleanup unused variable
import { TemplateContext, EnrichedTemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';
    // @ts-ignore - Audit cleanup unused variable
import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';

import { getEnriched } from './base-helpers.js';

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

