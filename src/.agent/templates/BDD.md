# 🧪 Template: BDD — Behavior-Driven Development

> Um cenário para cada critério de aceite + cenários de erro + edge cases.

---

## Feature: [Nome da Feature]

```gherkin
Feature: [Nome da Feature]
  Como usuário,
  Quero interagir com o sistema,
  Para alcançar meu objetivo de negócio.

  # ── Happy Path ──

  Scenario: [cenário principal - sucesso]
    Given [contexto / pré-condição]
    And [contexto adicional, se necessário]
    When [ação do usuário]
    Then [resultado esperado]
    And [efeito colateral, se houver]

  # ── Validações ──

  Scenario: Validação de dados obrigatórios
    Given um formulário de criação
    When o usuário tenta enviar sem preencher campos obrigatórios
    Then mensagens de erro são exibidas para cada campo

  # ── Edge Cases ──

  Scenario: Lidar com valores boundary
    Given o sistema aceita valores de 0 a 999999.99
    When o usuário tenta inserir um valor fora do range
    Then um erro de validação é retornado

  # ── Permissões ──

  Scenario: [cenário de acesso negado]
    Given [usuário sem permissão]
    When [tenta acessar recurso]
    Then [resposta 403 / redirect]
```

---

## Checklist

```
□ Cada critério de aceite tem ≥ 1 cenário
□ Happy path coberto
□ Error paths cobertos
□ Edge cases cobertos
□ Permissões/autenticação cobertos
□ Cenários são independentes entre si
```
