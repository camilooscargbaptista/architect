---
antigravity:
  trigger: 'on_demand'
  description: 'Tech Debt Controller — Controle de débito técnico e metas de score'
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

> Controle de débito técnico para @girardelli/architect

## Estado Atual

| Métrica | Valor |
|---------|-------|
| Score | 94/100 |
| Meta | 100/100 |
| Anti-patterns | 0 |
| Refatorações pendentes | 14 |
| Estimativa de Melhora | +0 pontos |

## Anti-Patterns Detectados (Agrupados por Severidade)









✅ Nenhum anti-pattern detectado.

## Hotspots de Acoplamento (Tech Debt)

Arquivos com alta complexidade de acoplamento — priorizar refatoração:

- `src/core/types.js` — Alto acoplamento detectado
- `src/core/agent-generator/types.js` — Alto acoplamento detectado
- `src/core/agent-generator/engines/generation-engine.ts` — Alto acoplamento detectado
- `tests/template-generation.test.ts` — Alto acoplamento detectado
- `scripts/decompose-detectors.ts` — Alto acoplamento detectado
- `src/adapters/html-reporter.ts` — Alto acoplamento detectado
- `src/core/architect.ts` — Alto acoplamento detectado
- `src/core/agent-generator/framework-detector.ts` — Alto acoplamento detectado
- `scripts/decompose-enrichers.ts` — Alto acoplamento detectado
- `src/types.js` — Alto acoplamento detectado


## Débito em Cobertura de Teste

**9 módulos sem testes adequados detectados.**

> 📋 Lista canônica e gates de cobertura: ver [QUALITY-GATES.md](../guards/QUALITY-GATES.md#módulos-sem-testes)

**Plano de ação:**
1. Priorizar módulos com mais dependências
2. Seguir workflow TDD para cada módulo
3. Meta: reduzir lista a zero em 3 sprints


## Roadmap de Refatoração

Prioridade por impacto:


1. **Split hub file: types.js** — `src/core/types.js` has 47 incoming connections. Split into 11 focused modules to reduce coupling.
   - Tier: Crítico
   - Prioridade: CRITICAL


2. **Split hub file: types.js** — `src/core/agent-generator/types.js` has 46 incoming connections. Split into 8 focused modules to reduce coupling.
   - Tier: Crítico
   - Prioridade: CRITICAL


3. **Split hub file: utils.js** — `src/adapters/html-reporter/utils.js` has 9 incoming connections. Split into 2 focused modules to reduce coupling.
   - Tier: Crítico
   - Prioridade: CRITICAL


4. **Reduce cross-boundary imports: template-generation.test.ts** — `tests/template-generation.test.ts` imports from 5 different modules: `src/agent-generator`, `src`, `src/agent-generator/templates/core`, `src/agent-generator/templates/domain`, `src/agent-generator/templates/stack`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: HIGH


5. **Reduce cross-boundary imports: generation-engine.ts** — `src/core/agent-generator/engines/generation-engine.ts` imports from 5 different modules: `src/core`, `src/core/agent-generator`, `src/core/agent-generator/templates/core`, `src/core/agent-generator/templates/stack`, `src/core/agent-generator/templates/domain`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: HIGH


6. **Reduce cross-boundary imports: html-reporter.ts** — `src/adapters/html-reporter.ts` imports from 4 different modules: `src/adapters/html-reporter`, `src/adapters/html-reporter/sections`, `src/core`, `src/core/agent-generator`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: MEDIUM


7. **Reduce cross-boundary imports: template-helpers.test.ts** — `tests/template-helpers.test.ts` imports from 3 different modules: `src/agent-generator/templates`, `src/agent-generator`, `src`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: MEDIUM


8. **Reduce cross-boundary imports: architect.ts** — `src/core/architect.ts` imports from 3 different modules: `src/infrastructure`, `src/adapters`, `src/core/agent-generator`. Consider using a facade or dependency injection.
   - Tier: Crítico
   - Prioridade: MEDIUM



... e mais 6 steps no plano completo.


## Metas de Score

```
Score Atual:            94/100
Meta Curto Prazo:       99/100
Meta Médio Prazo:       100/100
Mínimo Aceitável:       70/100
```

## Regras

```
□ Score NUNCA pode regredir após um PR
□ Mínimo: 70/100
□ Críticos: resolver dentro de 1 sprint
□ Altos: resolver dentro de 2 sprints
□ Médios: adicionar ao backlog técnico
□ Verificar com: architect score ./src
```


## 🔗 Cross-References (Agentes Relacionados)

| Agente | Quando Consultar |
|--------|-----------------|
| **Backend Developer** | Refatoração de módulo, god class |
| **Security Auditor** | Débito de segurança (dependencies, configs) |

> **Regra:** Nunca implementar isoladamente. Sempre verificar se o agente relacionado precisa ser consultado.


---

**Gerado por Architect v3.1**
