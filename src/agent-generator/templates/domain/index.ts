/**
 * Domain templates — C4, BDD, TDD, ADR, Threat Model.
 * Reutilizable templates referenced by workflows and agents.
 */

export function generateC4Template(): string {
  return `# 🏗️ Template: Arquitetura C4

> Preencher os 4 níveis relevantes para a feature/mudança.

---

## Nível 1 — Contexto

> Visão de pássaro: quem são os atores e sistemas envolvidos?

\`\`\`
Atores:
- [ator 1]: [descrição do papel]
- [ator 2]: [descrição do papel]

Sistemas Externos:
- [sistema 1]: [como interage]
- [sistema 2]: [como interage]

Fluxo de dados:
[ator] → [sistema] → [nosso sistema] → [resposta]
\`\`\`

---

## Nível 2 — Container

> Quais serviços, apps, bancos de dados são tocados?

\`\`\`
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │───▶│   Backend    │───▶│   Database   │
│   (Web/App)  │    │   (API)      │    │   (PostgreSQL)│
└──────────────┘    └──────────────┘    └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │  External    │
                    │  Service     │
                    └──────────────┘
\`\`\`

---

## Nível 3 — Componente

> Quais módulos, classes, serviços são criados ou modificados?

\`\`\`
Módulo: [nome]
├── Controller: [nome] — [responsabilidade]
├── Service: [nome] — [responsabilidade]
├── Entity: [nome] — [campos principais]
├── DTO: [nome] — [campos de request/response]
└── Tests: [lista de testes]
\`\`\`

---

## Nível 4 — Código (se complexo)

> Interfaces, tipos, contratos. Apenas para decisões complexas.

\`\`\`typescript
interface IExemploService {
  metodo(param: Tipo): Promise<Retorno>;
}
\`\`\`

---

## Decisões Arquiteturais

Se a decisão é significativa → criar ADR separado (ver template ADR).
`;
}

export function generateBddTemplate(): string {
  return `# 🧪 Template: BDD — Behavior-Driven Development

> Um cenário para cada critério de aceite + cenários de erro + edge cases.

---

## Feature: [Nome da Feature]

\`\`\`gherkin
Feature: [Nome da Feature]
  Como [ator],
  Quero [ação],
  Para [benefício].

  # ── Happy Path ──

  Scenario: [cenário principal - sucesso]
    Given [contexto / pré-condição]
    And [contexto adicional, se necessário]
    When [ação do usuário]
    Then [resultado esperado]
    And [efeito colateral, se houver]

  # ── Validações ──

  Scenario: [cenário de validação 1]
    Given [contexto]
    When [ação com dados inválidos]
    Then [mensagem de erro esperada]

  # ── Edge Cases ──

  Scenario: [cenário edge case]
    Given [contexto específico / boundary]
    When [ação]
    Then [comportamento esperado]

  # ── Permissões ──

  Scenario: [cenário de acesso negado]
    Given [usuário sem permissão]
    When [tenta acessar recurso]
    Then [resposta 403 / redirect]
\`\`\`

---

## Checklist

\`\`\`
□ Cada critério de aceite tem ≥ 1 cenário
□ Happy path coberto
□ Error paths cobertos
□ Edge cases cobertos
□ Permissões/autenticação cobertos
□ Cenários são independentes entre si
\`\`\`
`;
}

export function generateTddTemplate(): string {
  return `# 🔬 Template: TDD — Test-Driven Development

> RED → GREEN → REFACTOR. Nesta ordem. Sempre.

---

## Estrutura de Testes

\`\`\`
describe('[Nome do Módulo/Classe]', () => {

  describe('[método/função]', () => {

    // ── Happy Path ──
    it('should [resultado esperado] when [condição]', () => {
      // Arrange
      const input = ...;

      // Act
      const result = metodo(input);

      // Assert
      expect(result).toEqual(expected);
    });

    // ── Error Path ──
    it('should throw [erro] when [condição inválida]', () => {
      // Arrange
      const invalidInput = ...;

      // Act & Assert
      expect(() => metodo(invalidInput)).toThrow(ErroEsperado);
    });

    // ── Boundary ──
    it('should handle [boundary case]', () => {
      // Arrange
      const boundaryInput = ...;

      // Act
      const result = metodo(boundaryInput);

      // Assert
      expect(result).toEqual(expected);
    });
  });
});
\`\`\`

---

## Ciclo TDD

\`\`\`
1. RED:    Escrever teste que FALHA
2. GREEN:  Escrever código MÍNIMO para passar
3. REFACTOR: Melhorar sem quebrar testes
4. REPEAT
\`\`\`

---

## Checklist

\`\`\`
□ Teste escrito ANTES do código
□ Teste falha antes da implementação (RED)
□ Implementação mínima para passar (GREEN)
□ Refatoração sem quebrar testes (REFACTOR)
□ Happy path coberto
□ Error path coberto
□ Boundary cases cobertos
□ Cobertura atinge o mínimo do projeto
\`\`\`
`;
}

export function generateAdrTemplate(): string {
  return `# 📋 Template: ADR — Architecture Decision Record

> Use quando uma decisão técnica é significativa ou controversa.

---

## ADR-XXX: [Título da Decisão]

**Status:** proposed | accepted | deprecated | superseded by ADR-YYY
**Data:** YYYY-MM-DD
**Autores:** [quem participou da decisão]

---

### Contexto

> Qual é o problema ou necessidade que levou a esta decisão?

[descrever o contexto de negócio e técnico]

---

### Decisão

> O que foi decidido?

[descrever a decisão claramente]

---

### Alternativas Consideradas

| # | Alternativa | Prós | Contras | Por que descartada |
|---|-----------|------|---------|-------------------|
| 1 | [alternativa] | [prós] | [contras] | [motivo] |
| 2 | [alternativa] | [prós] | [contras] | [motivo] |

---

### Consequências

**Positivas:**
- [consequência positiva 1]
- [consequência positiva 2]

**Negativas:**
- [consequência negativa 1]
- [mitigação: como minimizar]

**Riscos:**
- [risco 1] — probabilidade: [alta/média/baixa]

---

### Notas

- [qualquer informação adicional]
`;
}

export function generateThreatModelTemplate(): string {
  return `# 🛡️ Template: Threat Model (STRIDE)

> Use para features que lidam com dados sensíveis, pagamentos, autenticação.

---

## Feature: [Nome]

### Atores e Assets

| Ator | Nível de Confiança | Assets que Acessa |
|------|-------------------|------------------|
| [ator 1] | [alto/médio/baixo] | [dados/recursos] |

---

### Análise STRIDE

| Categoria | Ameaça | Probabilidade | Impacto | Mitigação |
|-----------|--------|-------------|---------|-----------|
| **S**poofing | [identidade falsa] | [A/M/B] | [A/M/B] | [como prevenir] |
| **T**ampering | [alteração de dados] | [A/M/B] | [A/M/B] | [como prevenir] |
| **R**epudiation | [negar ação] | [A/M/B] | [A/M/B] | [audit log] |
| **I**nformation Disclosure | [vazamento de dados] | [A/M/B] | [A/M/B] | [criptografia] |
| **D**enial of Service | [indisponibilidade] | [A/M/B] | [A/M/B] | [rate limiting] |
| **E**levation of Privilege | [escalar permissão] | [A/M/B] | [A/M/B] | [RBAC] |

---

### Dados Sensíveis

| Dado | Classificação | Proteção |
|------|-------------|----------|
| [dado 1] | PII / Financeiro / Auth | [como proteger] |

---

### Checklist de Segurança

\`\`\`
□ Input validado e sanitizado
□ Output encodado (XSS prevention)
□ Queries parametrizadas (SQL injection)
□ Autenticação obrigatória
□ Autorização por role/permission
□ Dados sensíveis criptografados at rest
□ Dados sensíveis criptografados in transit (TLS)
□ Rate limiting implementado
□ Audit log para ações sensíveis
□ Secrets em variáveis de ambiente (não hardcoded)
\`\`\`
`;
}
