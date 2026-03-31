---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'QUALITY GATES — Critérios mínimos obrigatórios para src'
  priority: CRITICAL
---

# 🚦 QUALITY GATES — src

> **Sem aprovação em TODOS os gates CRITICAL, nenhuma entrega é aceita.**

---

## 🔴 CRITICAL (Obrigatórios — Bloqueiam Merge)

| # | Gate | Critério | Verificação |
|---|------|----------|-------------|
| C1 | **Compilação** | Build completa sem erros | `npm run build` |
| C2 | **Testes** | 100% dos testes passam | `npm test` |
| C3 | **Lint** | Zero errors (warnings tolerados) | `npx eslint .` |
| C4 | **Cobertura** | ≥ 80% | `npm run test -- --coverage` |
| C5 | **Segurança** | Zero vulnerabilidades CRITICAL | SECURITY-AUDITOR review |
| C6 | **Regras de Negócio** | Todos os critérios de aceite cobertos | BDD scenarios green |

---

## 🟡 IMPORTANT (Esperados — Devem ser justificados se ausentes)

| # | Gate | Critério |
|---|------|----------|
| I1 | **Documentação** | API documentada, README atualizado se necessário |
| I2 | **Code Review** | Pelo menos 1 revisor aprovou |
| I3 | **UI/UX** | Mockup aprovado, padrão visual seguido |
| I4 | **Performance** | Sem degradação mensurável (benchmark se aplicável) |
| I5 | **Score** | architect score ≥ 70/100, sem regressão |

---

## 🟢 DESIRABLE (Boas práticas — Não bloqueiam, mas são monitoradas)

| # | Gate | Critério |
|---|------|----------|
| D1 | **Clean Code** | Sem code smells detectados |
| D2 | **Arquitetura** | Sem novos anti-patterns |
| D3 | **Git** | Commits semânticos, branch naming correto |
| D4 | **Observabilidade** | Logging adequado, métricas expostas |

---

## 📊 Tabela de Métricas

| Métrica | Mínimo | Ideal | Blocker se |
|---------|--------|-------|-----------|
| Cobertura de testes | 80% | 90%+ | < 80% |
| Complexidade ciclomática | — | < 10 | > 20 |
| Linhas por arquivo | — | < 300 | > 500 |
| Métodos por classe | — | < 10 | > 20 |
| Score Architect | 70/100 | 80+ | < 70 |
| Anti-patterns CRITICAL | 0 | 0 | > 0 |
| Dependencies per file | — | < 5 | > 10 |



---

## ⚠️ Módulos Sem Testes

Os seguintes módulos **DEVEM TER** cobertura de testes antes de merge:

- ⚠️ `agent-generator`
- ⚠️ `html-reporter`
- ⚠️ `summarizer`
- ⚠️ `rules`
- ⚠️ `analyzers`
- ⚠️ `scripts`
- ⚠️ `ast`
- ⚠️ `agent-runtime`
- ⚠️ `locales`
- ⚠️ `@actions`

**Ação Obrigatória:** Criar testes para cada módulo listado acima. Se a cobertura for impossível, documentar no BLOCKERS.

---

## ⛔ BLOCKERS — Merge PROIBIDO se:

```
❌ console.log / print() em código de produção
❌ TODO / FIXME / HACK sem issue vinculada
❌ any (TypeScript) / type: ignore (Python) sem justificativa
❌ Testes com .skip() ou @pytest.mark.skip sem motivo
❌ Secrets, tokens ou senhas hardcoded
❌ Push direto em main/develop
❌ Arquivos > 500 linhas sem justificativa
❌ Imports circulares
```



---

## ✅ Checklists por Camada

### Backend 

```
□ Validação de entrada em TODOS os endpoints
□ Tratamento de erros com mensagens claras
□ DTOs para request e response (nunca entity direto)
□ Testes unitários para services
□ Testes de integração para controllers
□ Migrations reversíveis
□ Sem N+1 queries
□ Rate limiting em endpoints públicos
□ Logging estruturado (não console.log)
```

### Frontend (skip se não aplicável)

```
□ Componentes seguem padrão visual do sistema
□ Estado gerenciado corretamente (não prop drilling)
□ Loading states implementados
□ Error states implementados
□ Empty states implementados
□ Responsivo (mobile-first se web)
□ Formulários com validação client-side
□ Sem lógica de negócio em componentes (extrair para service)
□ Lazy loading onde aplicável
```

### Mobile (Flutter) (skip se não aplicável)

```
□ Widgets seguem padrão visual do app
□ Navegação consistente (back button, deep link)
□ Loading/error/empty states implementados
□ Comportamento offline graceful
□ Sem lógica de negócio em widgets
□ Performance de scroll (ListView.builder, não Column)
□ Tamanhos de fonte acessíveis
```

### Database (skip se não aplicável)

```
□ Migration reversível (up + down)
□ Índices para queries frequentes
□ Foreign keys onde aplicável
□ Constraints de integridade (NOT NULL, UNIQUE, CHECK)
□ Seed data atualizado
□ Impacto em queries existentes avaliado
□ Sem ALTER TABLE em tabelas com milhões de rows sem plano
```



---

## 🔄 Processo de Verificação (4 Estágios)

### Estágio 1: Antes de Começar
```
□ PREFLIGHT completo
□ Sei quais gates se aplicam à minha tarefa
□ Ambiente verificado (build + tests green)
```

### Estágio 2: Durante Desenvolvimento
```
□ Rodo testes a cada mudança significativa
□ Verifico lint periodicamente
□ Não acumulo débito técnico
```

### Estágio 3: Antes de Commit
```
□ TODOS os gates CRITICAL passam
□ Gates IMPORTANT justificados se não atendidos
□ Build + Tests + Lint + Coverage ✓
□ $ architect score ./src → sem regressão
```

### Estágio 4: Antes de PR
```
□ Branch atualizada com base
□ Commit messages semânticos
□ Descrição do PR completa
□ Code review solicitado
□ Documentação atualizada
```

---

## 🔌 Verificação Automatizada

Antes de qualquer PR, execute:

```bash
# Quality gate completo
npm run build && \
npm run test -- --coverage && \
npx @girardelli/architect score . --format json
```

Score mínimo: **70/100**
Cobertura mínima: **80%**
Regra: **Score não pode regredir** em relação ao último report.

---

**Gerado por Architect v3.1 · Score: 83/100 · 2026-03-31**
