export const ptBR = {
  // === CLI ===
  cli: {
    phases: {
      scan: { label: 'FILE SCANNER', verb: 'Escaneando sistema de arquivos' },
      dependencies: { label: 'DEPENDENCY MAPPER', verb: 'Mapeando grafo de importações' },
      layers: { label: 'LAYER DETECTOR', verb: 'Classificando arquitetura' },
      antipatterns: { label: 'PATTERN ANALYZER', verb: 'Detectando anti-patterns' },
      scoring: { label: 'QUALITY ENGINE', verb: 'Computando métricas de qualidade' },
      normalize: { label: 'PATH NORMALIZER', verb: 'Normalizando paths' },
      summarize: { label: 'AI SUMMARIZER', verb: 'Gerando sumário do projeto' }
    },
    results: {
      score: 'ARCHITECTURE SCORE',
      completedIn: 'Completado em',
      files: 'arquivos',
      lines: 'linhas',
      anitpatterns: 'anti-patterns',
      steps: 'passos',
      agents: 'agentes'
    }
  },

  // === AGONTS OUTPUTS ===
  agents: {
    generatedBy: 'Gerado por Architect v3.1',
    backend: {
      description: '{lang} Backend Developer — APIs, serviços, lógica de negócio',
      title: '🔧 {lang} BACKEND DEVELOPER',
      specialistIn: 'Especialista em backend {fw} para {projectName}',
      stack: 'Stack',
      language: 'Linguagem',
      framework: 'Framework',
      architecture: 'Arquitetura',
      test: 'Teste',
      packageManager: 'Package Manager',
      currentScore: 'Score Atual',
      domainContext: 'Domínio & Contexto de Negócio',
      principles: 'Princípios (SOLID + Clean Architecture)',
      modules: 'Módulos do Projeto',
      projectStructure: 'Estrutura do Projeto (Detectada)',
      implementationRules: 'Regras de Implementação',
      implementationRulesBody: `□ Controller NUNCA contém lógica de negócio (apenas routing)
□ Service NUNCA acessa Request/Response diretamente
□ Entity NUNCA é exposta diretamente na API (usar DTO)
□ Validação de input no DTO / Guard / Pipe
□ Erros com mensagens claras e códigos HTTP corretos
□ Logging estruturado (não console.log)
□ Testes unitários para cada service method
□ Testes de integração para cada endpoint
□ Cobertura ≥ {coverage}%`,
      afterImplementation: 'Após Implementação Backend',
      afterImplementationBody: `> **OBRIGATÓRIO: Gerar Documento de Integração antes de qualquer frontend/app.**

O documento deve conter:
- Todos os endpoints criados/modificados
- Payloads de request e response (com exemplos)
- Códigos de erro e mensagens
- Regras de negócio aplicadas
- Headers necessários (auth, pagination, etc.)`
    },
    frontend: {
      description: '{fw} Frontend Developer — Componentes, UX, state management',
      title: '🎨 {fw} FRONTEND DEVELOPER',
      specialistIn: 'Especialista em frontend {fw} para {projectName}',
      prerequisites: 'Pré-Requisitos para Implementar',
      prerequisitesBody: `╔══════════════════════════════════════════════╗
║  ANTES de escrever qualquer componente:     ║
║                                              ║
║  □ MOCKUP aprovado pelo humano              ║
║  □ Documento de Integração disponível       ║
║  □ User stories com critérios de aceite     ║
║  □ BDD scenarios escritos                   ║
╚══════════════════════════════════════════════╝`,
      implementationRules: 'Regras de Implementação',
      implementationRulesBody: `□ Componente segue MOCKUP aprovado (não inventar UI)
□ TODOS os estados implementados:
  - ✅ Com dados (estado normal)
  - 📭 Vazio (empty state)
  - ⏳ Carregando (loading state / skeleton)
  - ❌ Erro (error state com mensagem clara)
□ Lógica de negócio em services (NUNCA no componente)
□ State management adequado (sem prop drilling)
□ Formulários com validação client-side
□ Responsivo (testar mobile + desktop)
□ Acessibilidade básica (labels, aria, contraste)
□ Lazy loading onde aplicável
□ Cobertura ≥ {coverage}%`
    },
    security: {
      description: 'Security Auditor — Análise de ameaças, compliance, vulnerabilidades',
      title: '🛡️ SECURITY AUDITOR',
      analysisFor: 'Análise de segurança para {projectName}',
      checklist: 'Checklist OWASP Top 10',
      checklistBody: `□ A01: Broken Access Control — RBAC implementado?
□ A02: Cryptographic Failures — Dados sensíveis criptografados?
□ A03: Injection — Inputs sanitizados? Queries parametrizadas?
□ A04: Insecure Design — Threat model feito?
□ A05: Security Misconfiguration — Headers, CORS, defaults?
□ A06: Vulnerable Components — Deps atualizadas?
□ A07: Auth Failures — Brute force protegido? Session management?
□ A08: Software Integrity — Supply chain verificado?
□ A09: Logging Failures — Audit log para ações sensíveis?
□ A10: SSRF — Server-side requests validados?`,
      whenToActivate: 'Quando Ativar',
      whenToActivateBody: `- Qualquer feature que lida com: autenticação, autorização, dados pessoais, pagamentos
- Novas APIs públicas
- Integrações com sistemas externos
- Mudanças em infra/deploy`,
      expectedOutput: 'Output Esperado',
      expectedOutputBody: `1. Lista de findings com severidade (CRITICAL/HIGH/MEDIUM/LOW)
2. Recomendações de mitigação
3. Threat model (se aplicável)`
    },
    qa: {
      description: 'QA Test Engineer — Planos de teste, BDD/TDD, cobertura',
      title: '🧪 QA TEST ENGINEER',
      qualityFor: 'Qualidade de testes para {projectName}',
      nonNegotiable: 'Metas Inegociáveis',
      nonNegotiableBody: `╔══════════════════════════════════════════╗
║  Cobertura mínima: {coverage}%                ║
║  Sem testes, sem entrega, sem finalizar  ║
║  INEGOCIÁVEL.                            ║
╚══════════════════════════════════════════╝`,
      pyramid: 'Pirâmide de Testes',
      pyramidBody: `         ╱╲
        ╱ E2E╲         → Poucos, lentos, alto valor
       ╱──────╲
      ╱Integration╲    → Médio, validam integração
     ╱──────────────╲
    ╱   Unit Tests    ╲ → Muitos, rápidos, baratos
   ╱════════════════════╲`,
      process: 'Processo',
      processBody: `1. **BDD primeiro** — cenários Gherkin antes de código
2. **TDD** — RED → GREEN → REFACTOR
3. **Coverage** — verificar após cada implementação
4. **Regressão** — TODOS os testes antigos devem continuar passando
5. **Review** — testes são revisados junto com código`,
      refactoringRoadmap: 'Refactoring Roadmap'
    },
    techDebt: {
      description: 'Tech Debt Controller — Controle de débito técnico e metas de score',
      title: '📊 TECH DEBT CONTROLLER',
      controlFor: 'Controle de débito técnico para {projectName}',
      currentState: 'Estado Atual',
      stateTable: `| Métrica | Valor |
|---------|-------|
| Score | {score}/100 |
| Meta | {target}/100 |
| Anti-patterns | {antiPatterns} |
| Refatorações pendentes | {refactoringSteps} |
| Estimativa de Melhora | +{improvement} pontos |`,
      refactoringRoadmap: 'Roadmap de Refatoração',
      scoreTargets: 'Metas de Score',
      scoreTargetsBody: `Score Atual:            {score}/100
Meta Curto Prazo:       {targetShort}/100
Meta Médio Prazo:       {targetMedium}/100
Mínimo Aceitável:       {threshold}/100`,
      rules: 'Regras',
      rulesBody: `□ Score NUNCA pode regredir após um PR
□ Mínimo: {threshold}/100
□ Críticos: resolver dentro de 1 sprint
□ Altos: resolver dentro de 2 sprints
□ Médios: adicionar ao backlog técnico
□ Verificar com: architect score ./src`
    },
    codeReview: {
      description: 'Code Review Checklist — Pontos obrigatórios de revisão',
      title: '🔍 CODE REVIEW CHECKLIST — {projectName}',
      mandatoryRule: '**Todo PR deve ser verificado contra este checklist.**',
      mandatory: 'Obrigatório',
      mandatoryBody: `□ Código compila sem erros
□ Todos os testes passam
□ Cobertura ≥ {coverage}%
□ Lint sem errors
□ Nenhum secret hardcoded
□ Score não regrediu`,
      functional: 'Funcional',
      functionalBody: `□ Atende aos critérios de aceite
□ Edge cases tratados
□ Erros tratados adequadamente
□ Não quebra features existentes`,
      quality: 'Qualidade',
      qualityBody: `□ Código legível sem comentários explicativos
□ Naming descritivo e consistente
□ Funções pequenas e com responsabilidade única
□ Sem código duplicado (DRY)
□ Lógica complexa está isolada em funções testáveis
□ Sem grandes blocos de código comentado`,
      domainReviewItems: 'Itens de Revisão Específicos do Domínio: {domain}',
      domainRules: {
        fintech: `□ Transações são idempotentes?
□ Auditoria completa de todas as operações?
□ Sem exposição de dados sensíveis em logs?
□ Valores monetários não usam float (usar Decimal)?
□ PCI-DSS compliance verificado?`,
        healthtech: `□ LGPD compliance verificado (consentimento, retenção)?
□ Dados sensíveis criptografados em repouso?
□ Acesso auditado e logado?
□ Anonimização implementada corretamente?
□ 2FA em operações sensíveis?`,
        ecommerce: `□ Carrinho é idempotente?
□ Inventário é atualizado corretamente (race conditions)?
□ Preços são validados (sem manipulação client-side)?
□ Cupons/descontos aplicados corretamente?
□ Fraude detection implementado?`,
        default: `□ Fluxo crítico de negócio não quebrou?
□ Rollback é seguro?
□ Concorrência tratada?
□ State final é consistente?`
      },
      stackReviewItems: 'Checklist Específico para {stack}',
      stackRules: {
        ts: `□ \`strict: true\` em tsconfig (sem any sem justificativa)?
□ Imports circulares?
□ Async/await tratado (sem unhandled promises)?
□ Memory leaks (EventListeners desinscritos)?
□ Console.log/debugger removidos?`,
        python: `□ Type hints em todas as funções públicas?
□ Docstrings formatadas (Google ou NumPy style)?
□ Sem mutable default arguments?
□ Context managers usados para resources?
□ F-strings em vez de % ou .format()?
□ Sem \`eval()\` ou \`exec()\`?`,
        go: `□ Erros tratados (não ignorados com _)?
□ Defer para cleanup?
□ Goroutines com contexto?
□ Race conditions testadas?
□ Timeouts implementados?`,
        dart: `□ Null-safety (! evitado)?
□ Widgets têm keys quando em listas?
□ BuildContext acessado apenas em build?
□ Listeners desinscritos?
□ Imagens/assets fazem lazy-load?`,
        default: `□ Código segue padrões do projeto?
□ Dependencies atualizadas?
□ Sem warnings do compilador/linter?`
      },
      integrationReviewItems: 'Itens de Revisão de Integração',
      integrationRulesBody: `□ Endpoint trata todos os status codes esperados?
□ Validação do payload de entrada?
{auth}
{validation}
□ Resposta segue o contrato documentado?
□ Erros retornam mensagens claras?
□ Rate limiting aplicado?
□ Logging estruturado?`
    }
  },

  // === DYNAMIC BLOCKS ===
  dynamic: {
    compliance: {
      title: 'Requisitos de Compliance Detectados',
      reason: 'Motivo',
      mandatoryChecks: 'Verificações Obrigatórias'
    },
    integrations: {
      title: 'Segurança em Integrações',
      threats: 'Ameaças',
      types: {
        payment: 'PCI-DSS, criptografia de dados sensíveis, tokenização',
        auth: 'MFA, session hijacking, credential stuffing',
        api: 'Rate limiting, API key rotation, HTTPS obrigatório',
        database: 'SQL Injection, Encryption at rest, Backups',
        government: 'Compliance regulatório, audit trails, data retention',
        default: 'Validação de entrada/saída, rate limiting'
      }
    },
    domainThreats: {
      title: 'Ameaças Específicas do Domínio: {domain}',
      fintech: `- **Manipulação de dados:** Auditoria de transações, checksums, criptografia
- **Acesso não autorizado:** MFA em contas privilégiadas, IP whitelist
- **Conformidade:** PCI-DSS, LGPD, SOX
- **Fraude:** Detecção de anomalias, rate limiting`,
      healthtech: `- **Vazamento de dados:** Criptografia end-to-end, anonimização
- **HIPAA/LGPD:** Audit trails, consentimento explícito
- **Integridade:** Assinatura digital, blockchain se aplicável
- **Acesso:** RBAC granular, 2FA para dados sensíveis`,
      ecommerce: `- **Fraude de pagamento:** CVV validation, 3D Secure
- **Roubo de dados:** SSL/TLS, PCI-DSS, criptografia em repouso
- **DoS:** Rate limiting, CAPTCHA, WAF
- **Autenticação:** MFA, session timeout`,
      default: `- **Confidencialidade:** Dados em trânsito e repouso criptografados
- **Integridade:** Validação de entrada, checksums
- **Disponibilidade:** Backup, disaster recovery, monitoring
- **Auditoria:** Logging de ações sensíveis, retention policy`
    },
    qaDomain: {
      title: 'Cenários de Teste Específicos do Domínio: {domain}',
      fintech: `### Testes de Negócio
- Criar transação com valores válidos
- Rejeitar transação acima do limite
- Processar reembolso corretamente
- Auditoria de todas as transações
- Validar saldo após múltiplas operações

### Testes de Segurança
- Não expor dados de cartão em logs
- Validar PCI-DSS compliance
- Testar detecção de fraude`,
      healthtech: `### Testes de Negócio
- Criar registro de paciente com LGPD compliance
- Validar consentimento antes de compartilhar dados
- Anonimizar dados corretamente
- Respeitar direito ao esquecimento
- Auditoria de acesso a dados sensíveis

### Testes de Segurança
- Criptografia end-to-end em repouso
- Validar 2FA para dados críticos
- Testar retenção de dados`,
      ecommerce: `### Testes de Negócio
- Criar carrinho com múltiplos produtos
- Aplicar desconto/cupom corretamente
- Processar pagamento com validação 3DS
- Atualizar inventário após venda
- Gerar pedido com status correto

### Testes de Segurança
- Não expor dados de cartão
- Validar rate limiting em checkout
- Testar proteção contra fraud`,
      default: `### Testes de Negócio
- Fluxo principal (happy path)
- Edge cases e limites
- Concorrência (race conditions)
- Rollback após erro
- Idempotência

### Testes de Segurança
- Inputs inválidos/maliciosos
- Acesso não autorizado
- Rate limiting
- Logging correto`
    }
  }
};

// Types mapped from ptBR structure
export type AppTranslation = typeof ptBR;
