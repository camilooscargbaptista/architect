import { TemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';

/**
 * Generates 01-architecture.md — layer rules, dependency direction,
 * module patterns, and anti-pattern prevention.
 */
export function generateArchitectureRules(ctx: TemplateContext): string {
    // @ts-ignore - Audit cleanup unused variable
  const { stack, projectName, report, config } = ctx;
  const layerRules = buildLayerRules(ctx);
  const modulePattern = buildModulePattern(ctx);

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras de arquitetura para ${projectName}'
  priority: HIGH
---

# 🏗️ Regras de Arquitetura — ${projectName}

> **Separação de camadas, direção de dependências, e padrões de módulo.**

---

## 📐 Camadas Arquiteturais

${layerRules}

### Direção de Dependência (OBRIGATÓRIA)

\`\`\`
UI / Controllers  →  Services  →  Repositories / Data  →  Entities
       ↓                ↓                 ↓
   (pode usar)     (pode usar)      (pode usar)
   Services        Repositories     Entities
   DTOs            Entities         Value Objects
                   DTOs

⚠️  NUNCA:
   Entity → Controller
   Repository → Controller
   Service → Controller
   Data Layer → UI Layer
\`\`\`

### Regra de Ouro das Camadas

\`\`\`
╔══════════════════════════════════════════════════════╗
║  Uma camada SÓ pode depender de camadas ABAIXO.     ║
║  NUNCA de camadas acima ou da mesma camada lateral. ║
╚══════════════════════════════════════════════════════╝
\`\`\`

---

## 📦 Padrão de Módulo

${modulePattern}

---

## 🚫 Anti-Patterns a Prevenir

### God Class (> 500 linhas ou > 10 métodos)
\`\`\`
❌ PROIBIDO: Classe com múltiplas responsabilidades
✅ CORRETO: Extrair em classes menores com responsabilidade única

Se um arquivo ultrapassar 500 linhas:
1. PARAR
2. Identificar responsabilidades distintas
3. Extrair em módulos separados
4. Atualizar imports
\`\`\`

### Circular Dependencies
\`\`\`
❌ PROIBIDO: A importa B, B importa A
✅ CORRETO: Extrair interface comum ou usar event/mediator

Detecção:
$ npx madge --circular src/
$ architect anti-patterns .
\`\`\`

### Leaky Abstractions
\`\`\`
❌ PROIBIDO: Service expondo detalhes de implementação
✅ CORRETO: Interface define contrato, implementação é encapsulada

Exemplos:
- Service retornando QueryBuilder → ERRADO (vaza ORM)
- Service retornando DTO → CORRETO (abstrai)
- Controller acessando Entity → ERRADO (vaza modelo)
- Controller acessando DTO → CORRETO (contrato)
\`\`\`

### Feature Envy
\`\`\`
❌ PROIBIDO: Método que usa mais atributos de outra classe que da própria
✅ CORRETO: Mover método para a classe que possui os dados
\`\`\`

### Shotgun Surgery
\`\`\`
❌ PROIBIDO: Mudança em 1 feature exige alterar 10+ arquivos
✅ CORRETO: Agrupar código relacionado no mesmo módulo

Se uma mudança toca > 5 arquivos:
1. PARAR
2. Reavaliar se o código está no lugar certo
3. Considerar refatoração preventiva
\`\`\`

---

## 🏛️ Princípios Arquiteturais

### DDD (Domain-Driven Design) — Quando Aplicável
\`\`\`
Entities:       Objetos com identidade (ID único)
Value Objects:  Objetos sem identidade (imutáveis)
Aggregates:     Cluster de entidades com root
Repositories:   Acesso a dados de Aggregates
Services:       Lógica que não pertence a nenhuma entidade
\`\`\`

### Clean Architecture
\`\`\`
Camada mais interna: Entities (regras de negócio)
Camada média:        Use Cases / Services (lógica de aplicação)
Camada externa:      Controllers, Gateways, Presenters (I/O)

Dependência: SEMPRE de fora para dentro, NUNCA o contrário.
\`\`\`

### Event-Driven — Quando Aplicável
\`\`\`
Usar eventos quando:
- Desacoplamento entre módulos é necessário
- Processamento assíncrono é aceitável
- Múltiplos handlers para um mesmo trigger

NÃO usar eventos quando:
- Resposta síncrona é necessária
- Transação atômica é obrigatória
- Ordem de execução importa
\`\`\`

---

## 📊 Anti-Patterns Atuais do Projeto

${report.antiPatterns.length > 0
    ? report.antiPatterns.map(a =>
      `- **${a.name}** (${a.severity}) em \`${a.location}\` — ${a.suggestion}`
    ).join('\n')
    : '✅ Nenhum anti-pattern detectado. Manter assim.'}

Score atual: **${report.score.overall}/100** | Meta: **${Math.min(100, report.score.overall + 10)}/100**

---

## ✅ Checklist de Arquitetura

Antes de criar qualquer módulo novo:

\`\`\`
□ Camada correta? (Controller vs Service vs Repository vs Entity)
□ Direção de dependência respeitada? (nunca de baixo para cima)
□ Módulo coeso? (tudo relacionado junto)
□ Sem circular dependency?
□ Sem God Class? (< 500 linhas, < 10 métodos)
□ Interface/abstração antes de implementação?
□ DTOs para comunicação entre camadas?
□ Testes por camada? (unit para service, integration para controller)
\`\`\`

---

**Gerado por Architect v8.1 · Score: ${report.score.overall}/100**
`;
}

function buildLayerRules(ctx: TemplateContext): string {
  const { stack } = ctx;

  if (stack.frameworks.includes('NestJS')) {
    return `| Camada | Responsabilidade | Padrão NestJS |
|--------|-----------------|---------------|
| **API** (Controllers) | Routing, validação de request, response shaping | \`*.controller.ts\` + \`@Controller()\` |
| **Service** | Lógica de negócio, orquestração | \`*.service.ts\` + \`@Injectable()\` |
| **Data** (Repository) | Acesso a dados, queries | \`*.repository.ts\` ou TypeORM Repository |
| **Entity** | Modelo de domínio | \`*.entity.ts\` + \`@Entity()\` |
| **DTO** | Contratos de request/response | \`*.dto.ts\` + class-validator |
| **Guard** | Autenticação/Autorização | \`*.guard.ts\` + \`@UseGuards()\` |
| **Pipe** | Validação/transformação | \`*.pipe.ts\` + \`@UsePipes()\` |`;
  }

  if (stack.frameworks.includes('Django') || stack.frameworks.includes('Flask') || stack.frameworks.includes('FastAPI')) {
    return `| Camada | Responsabilidade | Padrão Python |
|--------|-----------------|---------------|
| **API** (Views/Routes) | Routing, serialização | views.py / routes.py |
| **Service** | Lógica de negócio | services.py |
| **Data** (Repository/ORM) | Acesso a dados | models.py + managers |
| **Schema** | Validação I/O | serializers.py / schemas.py |
| **Tasks** | Processamento assíncrono | tasks.py (Celery) |`;
  }

  if (stack.frameworks.includes('Angular')) {
    return `| Camada | Responsabilidade | Padrão Angular |
|--------|-----------------|----------------|
| **Component** | UI rendering, user events | \`*.component.ts\` |
| **Service** | Lógica, API calls, state | \`*.service.ts\` + \`@Injectable()\` |
| **Model** | Interfaces/types | \`*.model.ts\` / \`*.interface.ts\` |
| **Guard** | Route protection | \`*.guard.ts\` + \`canActivate\` |
| **Interceptor** | HTTP middleware | \`*.interceptor.ts\` |
| **Pipe** | Data transformation | \`*.pipe.ts\` |`;
  }

  // Generic
  return `| Camada | Responsabilidade | Padrão |
|--------|-----------------|--------|
| **API / Controllers** | Routing, validação HTTP | controllers/ |
| **Service** | Lógica de negócio | services/ |
| **Data / Repository** | Acesso a dados | repositories/ |
| **Entity / Model** | Modelo de domínio | entities/ ou models/ |
| **DTO / Schema** | Contratos I/O | dto/ ou schemas/ |`;
}

function buildModulePattern(ctx: TemplateContext): string {
  const { stack } = ctx;
  const ext = stack.primary === 'Python' ? 'py' : stack.primary === 'Dart' ? 'dart' : 'ts';

  if (stack.frameworks.includes('NestJS')) {
    return `\`\`\`
src/modules/[nome-do-modulo]/
├── [nome].module.ts           → NestJS Module (imports, providers, exports)
├── [nome].controller.ts       → HTTP endpoints
├── [nome].controller.spec.ts  → Testes do controller
├── [nome].service.ts          → Lógica de negócio
├── [nome].service.spec.ts     → Testes do service
├── dto/
│   ├── create-[nome].dto.ts   → Request de criação
│   ├── update-[nome].dto.ts   → Request de atualização
│   └── [nome]-response.dto.ts → Response shape
├── entities/
│   └── [nome].entity.ts       → TypeORM entity
├── guards/                    → Guards específicos (se houver)
└── interfaces/                → Interfaces/types do módulo
\`\`\``;
  }

  if (stack.frameworks.includes('Angular')) {
    return `\`\`\`
src/app/modules/[nome-do-modulo]/
├── [nome].module.ts                → Angular Module
├── [nome]-routing.module.ts        → Routes
├── components/
│   ├── [nome]-list/
│   │   ├── [nome]-list.component.ts
│   │   ├── [nome]-list.component.html
│   │   ├── [nome]-list.component.scss
│   │   └── [nome]-list.component.spec.ts
│   └── [nome]-form/
│       └── ...
├── services/
│   ├── [nome].service.ts
│   └── [nome].service.spec.ts
├── models/
│   └── [nome].model.ts
└── guards/
\`\`\``;
  }

  return `\`\`\`
src/modules/[nome-do-modulo]/
├── [nome].module.${ext}
├── [nome].controller.${ext}  → Endpoints / API
├── [nome].service.${ext}     → Lógica de negócio
├── dto/                       → Request/Response shapes
├── entities/                  → Modelos de domínio
└── __tests__/                 → Testes do módulo
\`\`\``;
}
