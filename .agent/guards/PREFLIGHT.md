---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'PREFLIGHT — Checklist obrigatório pré-ação para @girardelli/architect'
  priority: CRITICAL
---

# ✈️ PREFLIGHT — Checklist Pré-Ação

> **NENHUMA ação de código é permitida antes de completar este checklist.**
> Pular qualquer fase é violação do protocolo.

---

## FASE 0: Preparação Mental

Antes de abrir qualquer arquivo:

```
□ Li e entendi a requisição COMPLETAMENTE
□ Sei qual WORKFLOW estou seguindo (new-feature / fix-bug / review)
□ Identifiquei as CAMADAS envolvidas (Backend / Frontend / App / Database)
□ Tenho CLAREZA sobre o que é esperado como entrega
□ Se algo não está claro → PAREI e PERGUNTEI ao humano
```

---

## FASE 1: Leitura Obrigatória

```
□ [00-general.md](../rules/00-general.md)         → Regras de Ouro do projeto
□ [QUALITY-GATES.md](./QUALITY-GATES.md)           → Métricas e blockers
□ LESSONS-LEARNED.md (se existir)                   → Erros passados
□ ERROR-PATTERNS.md (se existir)                    → Padrões de erro conhecidos
□ BUSINESS-RULES.md (se existir)                    → Regras de negócio do domínio
```

> **Objetivo:** Não repetir erros e entender o contexto antes de agir.

---

## FASE 2: Verificação de Ambiente

```bash
# Git: verificar branch e status
git branch --show-current        # NUNCA em main/develop direto
git status                       # Limpo antes de começar
git pull origin <branch>         # Sincronizado

# Deps: verificar se está tudo instalado
npm install

# Build: verificar se compila
npm run build

# Tests: verificar se passam ANTES de começar
npm test
```

```
□ Branch correta (NUNCA main/develop)
□ Working tree limpa
□ Dependências instaladas
□ Build passando
□ Testes passando ANTES da minha alteração
```

---

## FASE 3: Verificação de Regras de Negócio

```
□ Entendo QUEM são os atores afetados
□ Entendo QUAL é a regra de negócio envolvida
□ Verifiquei se existe documentação do domínio
□ Se a feature envolve dinheiro/pagamento → ATENÇÃO REDOBRADA
□ Se a feature envolve dados pessoais → verificar LGPD/compliance
□ Se a feature muda um fluxo existente → verificar impacto em features dependentes
```

---

## FASE 4: Before-Code Checklist (por Camada)

### 4A: Backend ✅

```
□ Entendo a estrutura de módulos existente
□ Sei onde criar/modificar controllers, services, entities
□ Verifiquei se já existe código similar (DRY)
□ DTOs e validações planejados
□ Tratamento de erros definido
□ Sei qual padrão de teste usar (unitário + integração)
□ Migrations planejadas (se houver alteração de banco)
```

### 4B: Frontend ⬜ (skip se não aplicável)

```
□ MOCKUP aprovado pelo humano
□ Entendo o state management utilizado
□ Sei onde criar/modificar componentes
□ Verificar padrão visual (cores, fontes, espaçamentos)
□ Responsividade considerada
□ Acessibilidade básica (labels, aria, contraste)
□ Documento de integração do backend disponível
```

### 4C: Mobile (Flutter) ⬜ (skip se não aplicável)

```
□ MOCKUP aprovado pelo humano
□ Entendo a navegação atual do app
□ Sei onde criar/modificar screens e widgets
□ Verificar padrão visual do app
□ Comportamento offline considerado
□ Documento de integração do backend disponível
```

### 4D: Database ⬜ (skip se não aplicável)

```
□ Schema atual compreendido
□ Migration reversível planejada
□ Índices necessários identificados
□ Impacto em queries existentes avaliado
□ Seed data / fixtures atualizados
□ Backup strategy para dados existentes
```

---

## FASE 5: Before-Commit

```
□ Build compila sem erros
□ TODOS os testes passam (velhos + novos)
□ Cobertura ≥ 80%
□ Lint sem warnings
□ Sem console.log / print() em produção
□ Sem TODO / FIXME sem issue
□ Sem secrets hardcoded
□ Sem arquivos > 500 linhas sem justificativa
□ Commit message segue padrão (feat: / fix: / refactor: / docs:)
□ Branch está atualizada com base (rebase se necessário)
```

---

## FASE 6: Before-Done

```
□ TODOS os critérios de aceite estão cobertos
□ Score não regrediu: architect score ./src ≥ 70/100
□ Documentação atualizada (se necessário)
□ LESSONS-LEARNED atualizado (se descobri algo novo)
□ PR criado com descrição completa
□ Code review solicitado
```

---

## 🚩 Red Flags — PARE IMEDIATAMENTE SE:

| Red Flag | Ação |
|----------|------|
| Não entendo a requisição | PARAR → Perguntar ao humano |
| Código que mexo tem 0% de cobertura | PARAR → Escrever testes ANTES |
| Estou modificando > 10 arquivos | PARAR → Reavaliar escopo |
| Build quebrou após minha mudança | PARAR → Reverter → Investigar |
| Estou copiando/colando código | PARAR → Extrair abstração |
| Estou trabalhando em main/develop | PARAR → Criar branch |
| Não tenho mockup e a feature tem UI | PARAR → Gate 1 primeiro |
| Estou escrevendo código sem testes | PARAR → TDD |

---

## 🔍 Template de Diagnóstico

Execute antes de qualquer implementação:

```bash
# Estrutura do projeto
find . -type f -name "*.ts" | head -30

# Dependências do módulo que vou modificar
grep -r "import.*from" --include="*.ts" [modulo]/ | head -20

# Testes existentes
find . -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" | head -20

# Score atual
npx @girardelli/architect score .
```

---

**Gerado por Architect v3.1 · Score: 94/100 · 2026-03-30**
