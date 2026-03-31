---
antigravity:
  trigger: 'on_demand'
  description: 'Tech Debt Controller — Technical debt backlog and score enforcement'
agent_card:
  id: 'tech-debt-controller'
  name: 'Tech Debt Controller'
  role: 'governance'
  capabilities: [debt-tracking, score-monitoring, refactoring-prioritization]
  inputs: [architecture-report, anti-patterns, score-history]
  outputs: [debt-backlog, refactoring-plan, score-targets]
  depends_on: []
version: 3.1.0
---

# 📊 TECH DEBT CONTROLLER

🟡 Projeto Médio (50-200 arquivos)

> Tech debt tracking for src

## Current State

| Metric | Value |
|---------|-------|
| Score | 83/100 |
| Target | 93/100 |
| Anti-patterns | 21 |
| Pending Refactors | 6 |
| Estimated Gain | +5 points |

## Anti-Patterns Detectados (Agrupados por Severidade)


### 🔴 CRÍTICOS (1)
- **God Class** — `adapters/cli.ts`
  Ação: Resolver no próximo sprint



### 🟠 ALTOS (13)
- **Shotgun Surgery** — `infrastructure/scanner.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `infrastructure/git-history.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/refactor-engine.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/project-summarizer.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/architect_deps.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/analyzer.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/summarizer/readme-reader.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/summarizer/purpose-inferrer.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/summarizer/package-reader.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/summarizer/module-inferrer.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/summarizer/keyword-extractor.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/ast/tree-sitter-parser.ts`
  Ação: Planejar correção para próximas 2 semanas
- **Shotgun Surgery** — `core/agent-runtime/executor.ts`
  Ação: Planejar correção para próximas 2 semanas



### 🟡 MÉDIOS (7)
- **Feature Envy** — `core/plugin-loader.ts`
  Ação: Adicionar ao backlog de técnico
- **Feature Envy** — `core/summarizer/readme-reader.ts`
  Ação: Adicionar ao backlog de técnico
- **Feature Envy** — `core/summarizer/package-reader.ts`
  Ação: Adicionar ao backlog de técnico
- **Feature Envy** — `core/summarizer/keyword-extractor.ts`
  Ação: Adicionar ao backlog de técnico
- **Feature Envy** — `core/ast/tree-sitter-parser.ts`
  Ação: Adicionar ao backlog de técnico
- **Feature Envy** — `core/agent-generator/enrichers/description-generator.ts`
  Ação: Adicionar ao backlog de técnico
- **Feature Envy** — `adapters/github-action.ts`
  Ação: Adicionar ao backlog de técnico






## Hotspots de Acoplamento (Tech Debt)

Arquivos com alta complexidade de acoplamento — priorizar refatoração:

- `core/types/core.js` — Alto acoplamento detectado
- `path` — Alto acoplamento detectado
- `fs` — Alto acoplamento detectado
- `core/agent-generator/types/template.js` — Alto acoplamento detectado
- `core/agent-generator/types/stack.js` — Alto acoplamento detectado
- `core/agent-generator/engines/generation-engine_deps.ts` — Alto acoplamento detectado
- `core/types/rules.js` — Alto acoplamento detectado
- `adapters/cli.ts` — Alto acoplamento detectado
- `index.ts` — Alto acoplamento detectado
- `core/architect_deps.ts` — Alto acoplamento detectado


## Débito em Cobertura de Teste

**10 módulos sem testes adequados detectados.**

> 📋 Lista canônica e gates de cobertura: ver [QUALITY-GATES.md](../guards/QUALITY-GATES.md#módulos-sem-testes)

**Plano de ação:**
1. Priorizar módulos com mais dependências
2. Seguir workflow TDD para cada módulo
3. Meta: reduzir lista a zero em 4 sprints


## Refactoring Roadmap

Prioridade por impacto:


1. **Split hub file: fs.py** — `fs` has 41 incoming connections. Split into 11 focused modules to reduce coupling.
   - Tier: Crítico
   - Prioridade: CRITICAL


2. **Split hub file: path.py** — `path` has 47 incoming connections. Split into 12 focused modules to reduce coupling.
   - Tier: Crítico
   - Prioridade: CRITICAL


3. **Reduce cross-boundary imports: cli.ts** — `adapters/cli.ts` imports from 6 different modules: `core`, `core/agent-runtime`, `.`, `infrastructure`, `core/types`, `@actions`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: HIGH


4. **Reduce cross-boundary imports: index.ts** — `index.ts` imports from 5 different modules: `core`, `infrastructure`, `adapters`, `core/agent-generator`, `core/analyzers`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: HIGH


5. **Reduce cross-boundary imports: generation-engine_deps.ts** — `core/agent-generator/engines/generation-engine_deps.ts` imports from 5 different modules: `core/types`, `core/agent-generator/types`, `core/agent-generator/templates/core`, `core/agent-generator/templates/stack`, `core/agent-generator/templates/domain`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: HIGH


6. **Group co-dependent files into `shared/`** — Files `logger.js`, `fs`, `path` are frequently imported together (co-import score: 6). Grouping them improves cohesion.
   - Tier: Crítico
   - Prioridade: MEDIUM




## Score Targets

```
Current Score:          83/100
Short-Term Target:      88/100
Mid-Term Target:        93/100
Minimum Acceptable:     70/100
```

## Enforcement Rules

```
□ Score MUST NEVER regress after a PR
□ Minimum allowed: 70/100
□ Critical: resolve within 1 sprint
□ High: resolve within 2 sprints
□ Medium: add to technical backlog
□ Verify using: architect score ./src
```


## 🔗 Cross-References (Agentes Relacionados)

| Agente | Quando Consultar |
|--------|-----------------|
| **Backend Developer** | Refatoração de módulo, god class |
| **Security Auditor** | Débito de segurança (dependencies, configs) |

> **Regra:** Nunca implementar isoladamente. Sempre verificar se o agente relacionado precisa ser consultado.


---

**Generated by Architect v3.1**
