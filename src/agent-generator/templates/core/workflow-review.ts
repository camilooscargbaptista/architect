import { TemplateContext } from '../../types.js';

/**
 * Generates enterprise-grade review.md workflow.
 * Structured code review with checklist per dimension.
 */
export function generateReviewWorkflow(ctx: TemplateContext): string {
  const { stack, projectName, config, report } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Workflow de code review estruturado para ${projectName}'
---

# 🔍 Workflow: Code Review

> **Code review não é "LGTM".**
> É uma verificação sistemática em 6 dimensões.

---

## Dimensão 1: Correção Funcional

\`\`\`
□ O código faz o que a US/task pede?
□ Todos os critérios de aceite estão cobertos?
□ Edge cases foram tratados?
□ Erros são tratados adequadamente?
□ Regras de negócio estão corretas?
\`\`\`

## Dimensão 2: Qualidade de Código

\`\`\`
□ Código legível sem comentários explicativos?
□ Naming é descritivo e consistente?
□ Sem duplicação (DRY)?
□ Funções/métodos com responsabilidade única?
□ Sem magic numbers (extrair para constantes)?
□ Tipos corretos (sem \`any\` / \`type: ignore\` injustificado)?
□ Sem código morto / comentado?
\`\`\`

## Dimensão 3: Testes

\`\`\`
□ Testes existem para o novo código?
□ Cobertura ≥ ${config.coverageMinimum}%?
□ Testes são significativos (não apenas \`expect(true).toBe(true)\`)?
□ Happy path coberto?
□ Error path coberto?
□ Edge cases cobertos?
□ Nenhum teste com .skip() injustificado?
\`\`\`

## Dimensão 4: Segurança

\`\`\`
□ Sem secrets hardcoded?
□ Input validado e sanitizado?
□ SQL injection prevenido (parameterized queries)?
□ XSS prevenido (output encoding)?
□ Autenticação/autorização verificada?
□ Dados sensíveis não logados?
□ Rate limiting em endpoints novos?
\`\`\`

## Dimensão 5: Performance

\`\`\`
□ Sem N+1 queries?
□ Queries com índice adequado?
□ Sem loops desnecessários sobre coleções grandes?
□ Lazy loading onde aplicável?
□ Sem memory leaks óbvios (subscriptions, listeners)?
□ Caching considerado onde faz sentido?
\`\`\`

## Dimensão 6: Arquitetura

\`\`\`
□ Segue os padrões do projeto (rules/)?
□ Camada correta (controller ≠ service ≠ entity)?
□ Sem violações de layer (data layer acessando UI)?
□ Score não regrediu: architect score ≥ ${config.scoreThreshold}/100
□ Sem novos anti-patterns CRITICAL?
□ Imports organizados, sem circulares?
\`\`\`

---

## Resultado do Review

| Resultado | Ação |
|-----------|------|
| ✅ Aprovado | Merge permitido |
| ⚠️ Aprovado com observações | Merge permitido, fix no próximo PR |
| ❌ Mudanças necessárias | Bloquear merge até resolver |
| 🔴 Bloqueado | Issue de segurança ou regressão — resolver imediatamente |

---

**Gerado por Architect v3.1 · Score: ${report.score.overall}/100 · ${new Date().toISOString().split('T')[0]}**
`;
}
