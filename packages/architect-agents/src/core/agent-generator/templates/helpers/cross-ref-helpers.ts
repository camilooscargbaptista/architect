import { TemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';

export function crossRef(agentId: string, ctx: TemplateContext): string {
  const { stack } = ctx;

  const agentRelations: Record<string, { id: string; name: string; when: string }[]> = {
    'backend': [
      { id: 'database-engineer', name: 'Database Engineer', when: 'Criar/alterar entities, migrations, queries' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Novo endpoint, auth flow, dados sensíveis' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — plano de testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Antes de criar novo módulo — verificar débito' },
    ],
    'frontend': [
      { id: 'backend', name: 'Backend Developer', when: 'Antes de integrar — doc de integração obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — testes e2e' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Forms, auth UI, dados sensíveis' },
    ],
    'flutter': [
      { id: 'backend', name: 'Backend Developer', when: 'Antes de integrar — doc de integração obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — testes de widget e integração' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Armazenamento local, biometria, deep links' },
    ],
    'database-engineer': [
      { id: 'backend', name: 'Backend Developer', when: 'Após migration — atualizar entities e queries' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Dados sensíveis, PII, encryption at rest' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Schema com N+1, índices faltantes' },
    ],
    'security-auditor': [
      { id: 'backend', name: 'Backend Developer', when: 'Falha de segurança em endpoint/service' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'Encryption at rest, data masking' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Testes de segurança (fuzzing, pentest)' },
    ],
    'qa-test': [
      { id: 'backend', name: 'Backend Developer', when: 'Cobertura insuficiente em services' },
      { id: 'frontend', name: 'Frontend Developer', when: 'Testes e2e falhando, componentes sem testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Testes com .skip(), mocks frágeis' },
    ],
    'tech-debt': [
      { id: 'backend', name: 'Backend Developer', when: 'Refatoração de módulo, god class' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'N+1 queries, índices, schema refactoring' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Débito de segurança (dependencies, configs)' },
    ],
    'code-review': [
      { id: 'security-auditor', name: 'Security Auditor', when: 'Review de endpoints, auth, dados sensíveis' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Verificar cobertura e qualidade dos testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Avaliar impacto em débito técnico' },
    ],
    'orchestrator': [
      { id: 'backend', name: 'Backend Developer', when: 'Features que tocam backend' },
      { id: 'frontend', name: 'Frontend Developer', when: 'Features que tocam frontend' },
      { id: 'flutter', name: 'Flutter UI Developer', when: 'Features que tocam app mobile' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'Features que tocam banco de dados' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'TODA feature — revisão obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'TODA feature — plano de testes obrigatório' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Antes de nova feature — checar débito' },
    ],
  };

  const relations = agentRelations[agentId] || [];
  const filtered = relations.filter(r => {
    if (r.id === 'frontend' && !stack.hasFrontend) return false;
    if (r.id === 'flutter' && !stack.hasMobile) return false;
    if (r.id === 'database-engineer' && !stack.hasDatabase) return false;
    return true;
  });

  if (filtered.length === 0) return '';

  return `
## 🔗 Cross-References (Agentes Relacionados)

| Agente | Quando Consultar |
|--------|-----------------|
${filtered.map(r => `| **${r.name}** | ${r.when} |`).join('\n')}

> **Regra:** Nunca implementar isoladamente. Sempre verificar se o agente relacionado precisa ser consultado.
`;
}

