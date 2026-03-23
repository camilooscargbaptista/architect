import { TemplateContext, EnrichedTemplateContext } from '../../types.js';
import { getEnriched, depthAtLeast, complianceBadges, depthIndicator } from '../template-helpers.js';

/**
 * Generates enterprise-grade QUALITY-GATES.md
 * 3-level gates (CRITICAL/IMPORTANT/DESIRABLE), per-layer checklists,
 * explicit blockers list, metrics table, 4-stage verification process.
 *
 * Context-aware: Adds compliance-specific gates, untested modules warnings,
 * and domain-specific blockers when enriched data is available.
 */
export function generateQualityGates(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { stack, projectName, config, report } = ctx;
  const enriched = getEnriched(ctx);

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'QUALITY GATES — Critérios mínimos obrigatórios para ${projectName}'
  priority: CRITICAL
---

# 🚦 QUALITY GATES — ${projectName}

> **Sem aprovação em TODOS os gates CRITICAL, nenhuma entrega é aceita.**

---

## 🔴 CRITICAL (Obrigatórios — Bloqueiam Merge)

| # | Gate | Critério | Verificação |
|---|------|----------|-------------|
| C1 | **Compilação** | Build completa sem erros | \`${enriched.toolchain?.buildCmd || (stack.packageManager === 'npm' ? 'npm run build' : stack.packageManager === 'pub' ? 'flutter build' : 'make build')}\` |
| C2 | **Testes** | 100% dos testes passam | \`${enriched.toolchain?.testCmd || (stack.testFramework === 'pytest' ? 'pytest' : stack.testFramework === 'flutter_test' ? 'flutter test' : 'npm run test')}\` |
| C3 | **Lint** | Zero errors (warnings tolerados) | \`${enriched.toolchain?.lintCmd || (stack.packageManager === 'npm' ? 'npm run lint' : stack.primary === 'Python' ? 'ruff check .' : 'dart analyze')}\` |
| C4 | **Cobertura** | ≥ ${config.coverageMinimum}% | \`${enriched.toolchain?.coverageCmd || (stack.testFramework === 'pytest' ? 'pytest --cov' : 'npm run test -- --coverage')}\` |
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
| I5 | **Score** | architect score ≥ ${config.scoreThreshold}/100, sem regressão |

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
| Cobertura de testes | ${config.coverageMinimum}% | 90%+ | < ${config.coverageMinimum}% |
| Complexidade ciclomática | — | < 10 | > 20 |
| Linhas por arquivo | — | < 300 | > 500 |
| Métodos por classe | — | < 10 | > 20 |
| Score Architect | ${config.scoreThreshold}/100 | 80+ | < ${config.scoreThreshold} |
| Anti-patterns CRITICAL | 0 | 0 | > 0 |
| Dependencies per file | — | < 5 | > 10 |

${enriched.domain?.compliance?.length ? `---

## 🔒 Compliance-Specific Gates

${enriched.domain?.compliance?.map((comp: any) => {
  const checks: Record<string, string> = {
    'LGPD': '□ Dados pessoais anonimizados em logs/cache\n□ Direito ao esquecimento implementado\n□ Consentimento explícito documentado',
    'HIPAA': '□ Criptografia AES-256 para PHI em repouso\n□ TLS 1.2+ para PHI em trânsito\n□ Auditoria de acesso a PHI registrada\n□ Business Associate Agreement (BAA) em vigor',
    'PCI-DSS': '□ Criptografia de dados de cartão (nunca armazenar)\n□ WAF ativo em endpoints de pagamento\n□ Segmentation: rede de cartões isolada\n□ Logs de acesso retidos por 1+ ano\n□ Penetration testing anual documentado',
    'SOX': '□ Trilha de auditoria completa para transações\n□ Controles de segregação de funções implementados\n□ Change management process documentado\n□ Acesso de usuário revogado em < 24h',
    'GDPR': '□ DPIA (Data Protection Impact Assessment) completada\n□ Processamento baseado em legal basis documentado\n□ Data residency (EU) garantido\n□ DPO nomeado se aplicável',
  };
  return `### ${comp.name}
${checks[comp.name] || `□ Verificar: ${comp.mandatoryChecks.join('\n□ Verificar: ')}`}`;
}).join('\n\n')}` : ''}

${enriched.untestedModules?.length ? `---

## ⚠️ Módulos Sem Testes

Os seguintes módulos **DEVEM TER** cobertura de testes antes de merge:

${enriched.untestedModules.map((m: any) => `- ⚠️ \`${m}\``).join('\n')}

**Ação Obrigatória:** Criar testes para cada módulo listado acima. Se a cobertura for impossível, documentar no BLOCKERS.` : ''}

---

## ⛔ BLOCKERS — Merge PROIBIDO se:

\`\`\`
${config.blockers.map(b => `❌ ${b}`).join('\n')}
\`\`\`

${enriched.domain?.compliance?.length ? `

### Domain-Specific Blockers (Compliance)

\`\`\`
${enriched.domain?.compliance?.map((comp: any) => {
  const blockers: Record<string, string> = {
    'LGPD': '❌ Senhas/tokens em logs (violação de privacidade)',
    'HIPAA': '❌ PHI (Protected Health Information) em texto claro',
    'PCI-DSS': '❌ Dados de cartão armazenados ou em logs',
    'SOX': '❌ Transação sem trilha de auditoria',
    'GDPR': '❌ Transferência de dados para fora da EU',
  };
  return blockers[comp.name] || `❌ Violação de ${comp.name}`;
}).join('\n')}
\`\`\`
` : ''}

---

## ✅ Checklists por Camada

### Backend ${stack.hasBackend ? '' : '(skip se não aplicável)'}

\`\`\`
□ Validação de entrada em TODOS os endpoints
□ Tratamento de erros com mensagens claras
□ DTOs para request e response (nunca entity direto)
□ Testes unitários para services
□ Testes de integração para controllers
□ Migrations reversíveis
□ Sem N+1 queries
□ Rate limiting em endpoints públicos
□ Logging estruturado (não console.log)
\`\`\`

### Frontend ${stack.hasFrontend ? '' : '(skip se não aplicável)'}

\`\`\`
□ Componentes seguem padrão visual do sistema
□ Estado gerenciado corretamente (não prop drilling)
□ Loading states implementados
□ Error states implementados
□ Empty states implementados
□ Responsivo (mobile-first se web)
□ Formulários com validação client-side
□ Sem lógica de negócio em componentes (extrair para service)
□ Lazy loading onde aplicável
\`\`\`

### Mobile (Flutter) ${stack.hasMobile ? '' : '(skip se não aplicável)'}

\`\`\`
□ Widgets seguem padrão visual do app
□ Navegação consistente (back button, deep link)
□ Loading/error/empty states implementados
□ Comportamento offline graceful
□ Sem lógica de negócio em widgets
□ Performance de scroll (ListView.builder, não Column)
□ Tamanhos de fonte acessíveis
\`\`\`

### Database ${stack.hasDatabase ? '' : '(skip se não aplicável)'}

\`\`\`
□ Migration reversível (up + down)
□ Índices para queries frequentes
□ Foreign keys onde aplicável
□ Constraints de integridade (NOT NULL, UNIQUE, CHECK)
□ Seed data atualizado
□ Impacto em queries existentes avaliado
□ Sem ALTER TABLE em tabelas com milhões de rows sem plano
\`\`\`

${depthAtLeast(ctx, 'large') ? `---

## 🏢 Governance Gates (Enterprise ${depthAtLeast(ctx, 'enterprise') ? '/ Large Projects' : 'Projects'})

${depthAtLeast(ctx, 'large') ? `\`\`\`
□ Change Advisory Board (CAB) review para temas de arquitetura
□ Aprovação do Tech Lead antes de merge em release branches
□ Documentação de decisões arquiteturais (ADR) para mudanças maiores
□ Impacto em performance/segurança avaliado formalmente
□ Backward compatibility verificado (database migrations, API versioning)
□ SLA e disponibilidade confirmados (para features críticas)
\`\`\`` : ''}
` : ''}

---

## 🔄 Processo de Verificação (4 Estágios)

### Estágio 1: Antes de Começar
\`\`\`
□ PREFLIGHT completo
□ Sei quais gates se aplicam à minha tarefa
□ Ambiente verificado (build + tests green)
\`\`\`

### Estágio 2: Durante Desenvolvimento
\`\`\`
□ Rodo testes a cada mudança significativa
□ Verifico lint periodicamente
□ Não acumulo débito técnico
\`\`\`

### Estágio 3: Antes de Commit
\`\`\`
□ TODOS os gates CRITICAL passam
□ Gates IMPORTANT justificados se não atendidos
□ Build + Tests + Lint + Coverage ✓
□ $ architect score ./src → sem regressão
\`\`\`

### Estágio 4: Antes de PR
\`\`\`
□ Branch atualizada com base
□ Commit messages semânticos
□ Descrição do PR completa
□ Code review solicitado
□ Documentação atualizada
\`\`\`

---

## 🔌 Verificação Automatizada

Antes de qualquer PR, execute:

\`\`\`bash
# Quality gate completo
${enriched.toolchain?.buildCmd || (stack.packageManager === 'npm' ? 'npm run build' : 'make build')} && \\
${enriched.toolchain?.coverageCmd || (stack.testFramework === 'pytest' ? 'pytest --cov' : stack.testFramework === 'flutter_test' ? 'flutter test --coverage' : 'npm run test -- --coverage')} && \\
npx @girardelli/architect score . --format json
\`\`\`

Score mínimo: **${config.scoreThreshold}/100**
Cobertura mínima: **${config.coverageMinimum}%**
Regra: **Score não pode regredir** em relação ao último report.

---

**Gerado por Architect v3.0 · Score: ${report.score.overall}/100 · ${new Date().toISOString().split('T')[0]}**
`;
}
