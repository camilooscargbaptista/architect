---
antigravity:
  trigger: 'on_demand'
  description: 'Code Review Checklist — Pontos obrigatórios de revisão'
---

# 🔍 CODE REVIEW CHECKLIST — @girardelli/architect

🟡 Projeto Médio (50-200 arquivos)

> **Todo PR deve ser verificado contra este checklist.**

## Obrigatório

```
□ Código compila sem erros
□ Todos os testes passam
□ Cobertura ≥ 80%
□ Lint sem errors
□ Nenhum secret hardcoded
□ Score não regrediu
```

## Funcional

```
□ Atende aos critérios de aceite
□ Edge cases tratados
□ Erros tratados adequadamente
□ Não quebra features existentes
```

## Qualidade

```
□ Código legível sem comentários explicativos
□ Naming descritivo e consistente
□ Sem duplicação (DRY)
□ Sem magic numbers
□ Sem any / type: ignore injustificado
□ Arquivos < 500 linhas
```

## Segurança

```
□ Inputs validados
□ Queries parametrizadas
□ Auth/authz verificados
□ Dados sensíveis protegidos
```

## Checklist Específico para TypeScript

□ `strict: true` em tsconfig (sem any sem justificativa)?
□ Imports circulares?
□ Async/await tratado (sem unhandled promises)?
□ Memory leaks (EventListeners desinscritos)?
□ Console.log/debugger removidos?

## Itens de Revisão Específicos do Domínio: devtools

□ Fluxo crítico de negócio não quebrou?
□ Rollback é seguro?
□ Concorrência tratada?
□ State final é consistente?

## Itens de Revisão de Integração

□ Endpoint trata todos os status codes esperados?
□ Validação do payload de entrada?


□ Resposta segue o contrato documentado?
□ Erros retornam mensagens claras?
□ Rate limiting aplicado?
□ Logging estruturado?



## 🔗 Cross-References (Agentes Relacionados)

| Agente | Quando Consultar |
|--------|-----------------|
| **Security Auditor** | Review de endpoints, auth, dados sensíveis |
| **QA Test Engineer** | Verificar cobertura e qualidade dos testes |
| **Tech Debt Controller** | Avaliar impacto em débito técnico |

> **Regra:** Nunca implementar isoladamente. Sempre verificar se o agente relacionado precisa ser consultado.


---

**Gerado por Architect v3.1**
