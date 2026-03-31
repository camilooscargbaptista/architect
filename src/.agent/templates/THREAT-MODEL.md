# 🛡️ Template: Threat Model (STRIDE)

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
| **S**poofing | Identidade falsa / autenticação fraca | M | A | MFA, JWT assinado, validação gov |
| **T**ampering | Alteração de dados em trânsito/repouso | M | A | HTTPS, assinatura digital, checksums |
| **R**epudiation | Negar ação realizada | M | A | Audit log detalhado com timestamp |
| **I**nformation Disclosure | Vazamento de dados sensíveis | A | A | Criptografia AES-256, LGPD compliance |
| **D**enial of Service | Serviço indisponível (DDoS, travamento) | M | A | Rate limiting, WAF, scaling automático |
| **E**levation of Privilege | Escalar permissão (user → admin) | M | A | RBAC granular, segregação de funções |

---

### Dados Sensíveis

| Dado | Classificação | Proteção |
|------|-------------|----------|
| [dado 1] | PII / Financeiro / Auth | [como proteger] |

---

### Conformidade e Requisitos Regulatórios

| Regulamento | Aplicável | Verificação |
|-------------|-----------|-------------|
| LGPD (dados pessoais) | Depende | Consentimento, direito ao esquecimento |
| Conformidade de Dados | Depende | Criptografia, HTTPS, audit logs |

---

### Checklist de Segurança

```
□ Input validado e sanitizado
□ Output encodado (XSS prevention)
□ Queries parametrizadas (SQL injection)
□ Autenticação obrigatória (MFA quando sensível)
□ Autorização por role/permission (RBAC)
□ Dados sensíveis criptografados at rest (AES-256)
□ Dados sensíveis criptografados in transit (TLS 1.2+)
□ Rate limiting implementado
□ Audit log para ações sensíveis (timestamp + usuário)
□ Secrets em variáveis de ambiente (não hardcoded)
□ Consentimento e transparência (LGPD/GDPR)
□ Testes de penetração agendados
```

