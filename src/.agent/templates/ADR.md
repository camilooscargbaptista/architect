# 📋 Template: ADR — Architecture Decision Record

> Use quando uma decisão técnica é significativa ou controversa.

---

## ADR-001: Uso de Backend Framework para Backend

**Status:** proposed | accepted | deprecated | superseded by ADR-YYY
**Data:** YYYY-MM-DD
**Autores:** [quem participou da decisão]

---

### Contexto

> Qual é o problema ou necessidade que levou a esta decisão?

O projeto requer uma API REST escalável com TypeScript. Precisamos escolher um framework que:
- Suporte TypeScript nativo
- Tenha decorators e dependency injection
- Tenha comunidade ativa e documentação excelente

---

### Decisão

> O que foi decidido?

Decidimos usar Backend Framework como framework backend principal. Backend Framework oferece:
- Arquitetura modular built-in
- Decorators para roteamento e middleware
- Injeção de dependência nativa
- Suporte a bancos de dados (TypeORM, Prisma, etc.)

---

### Alternativas Consideradas

| # | Alternativa | Prós | Contras | Por que descartada |
|---|-----------|------|---------|-------------------|
| 1 | Express.js + middleware customizado | [prós] | [contras] | [motivo] |
| 2 | Fastify | [prós] | [contras] | [motivo] |

---

### Consequências

**Positivas:**
- Arquitetura clara e escalável
- Código mais organizado e testável
- Comunidade ativa para suporte

**Negativas:**
- Curva de aprendizado para novos desenvolvedores
- Overhead de dependências

**Riscos:**
- Atualização de versões major — probabilidade: média

---

### Notas

- Revisar em 6 meses se a decisão continua válida


---

## ADR-002: Banco de Dados PostgreSQL

**Status:** accepted
**Data:** 2024-01-15
**Autores:** [equipe técnica]

### Contexto

Precisamos escolher um banco de dados relacional que:
- Suporte transações ACID
- Tenha integração com Backend Framework
- Permita escalabilidade horizontal

### Decisão

Escolhemos PostgreSQL como banco de dados principal por:
- Suporte a JSON nativo
- Excelente performance em leitura/escrita
- Integração com TypeORM/Prisma é padrão

### Alternativas Consideradas

| # | Alternativa | Prós | Contras |
|---|-----------|------|---------|
| 1 | MySQL | Popular, estável | Menos recursos avançados |
| 2 | MongoDB | Escalável | Sem ACID nativo, schema dinâmico |