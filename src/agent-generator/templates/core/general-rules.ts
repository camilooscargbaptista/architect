import { TemplateContext } from '../../types.js';
import { getEnriched } from '../template-helpers.js';

/**
 * Generates enterprise-grade 00-general.md rules.
 * Golden rules, git flow, project identity, naming conventions,
 * diagnostic requirements, forbidden actions, compliance checklist.
 */
export function generateGeneralRules(ctx: TemplateContext): string {
  const { stack, projectName, stackLabel, config, report } = ctx;
  const enriched = getEnriched(ctx);
  const namingConventions = buildNamingConventions(ctx);

  // Stack-aware forbidden type actions
  const langs = stack.languages.map((l) => l.toLowerCase());
  let typeProhibitions = `❌ any (TypeScript) sem justificativa em comentário
❌ @ts-ignore / type: ignore sem justificativa`;

  if (langs.includes('python')) {
    typeProhibitions = `❌ type: ignore sem justificativa em comentário
❌ # noqa sem justificativa
❌ Any (typing) sem justificativa em comentário`;
  } else if (langs.includes('dart')) {
    typeProhibitions = `❌ dynamic sem justificativa em comentário
❌ // ignore: sem justificativa
❌ as dynamic sem type-check`;
  } else if (langs.includes('java') || langs.includes('kotlin')) {
    typeProhibitions = `❌ @SuppressWarnings sem justificativa em comentário
❌ Object onde tipo específico é possível
❌ Raw types sem justificativa`;
  } else if (langs.includes('go')) {
    typeProhibitions = `❌ interface{}/any sem justificativa em comentário
❌ //nolint sem justificativa
❌ _ (blank identifier) para erros sem tratamento`;
  } else if (langs.includes('rust')) {
    typeProhibitions = `❌ unwrap() em código de produção sem justificativa
❌ #[allow(...)] sem justificativa em comentário
❌ unsafe sem revisão e justificativa`;
  }

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras gerais invioláveis para ${projectName}'
  priority: CRITICAL
---

# 📜 Regras Gerais — ${projectName}

> **Estas regras são INVIOLÁVEIS. Não há exceção.**

---

## 🏆 Regras de Ouro

\`\`\`
╔══════════════════════════════════════════════════════════════╗
║                    9 REGRAS DE OURO                         ║
║                                                              ║
${config.goldenRules.map((r, i) => `║  ${i + 1}. ${r.padEnd(55)}║`).join('\n')}
║                                                              ║
║  ⚠️  Violar qualquer regra = PARAR e RECOMEÇAR              ║
╚══════════════════════════════════════════════════════════════╝
\`\`\`

---

## 🏢 Identidade do Projeto

| Item | Valor |
|------|-------|
| **Nome** | ${projectName} |
| **Stack** | ${stackLabel} |
| **Score** | ${report.score.overall}/100 |
| **Linguagens** | ${stack.languages.join(', ')} |
| **Frameworks** | ${enriched.detectedFrameworks?.filter((f: any) => f.category === 'web' || f.category === 'orm').map((f: any) => `${f.name}${f.version ? ` v${f.version}` : ''}`).join(', ') || stack.frameworks.join(', ') || 'Nenhum detectado'} |
| **Cobertura Mínima** | ${config.coverageMinimum}% |
| **Score Mínimo** | ${config.scoreThreshold}/100 |

---

## 🔄 Fluxo Completo (Qualquer Ação)

\`\`\`
REQUISIÇÃO
    │
    ▼
LEITURA OBRIGATÓRIA (INDEX.md → 00-general → PREFLIGHT)
    │
    ▼
DIAGNÓSTICO (entender ANTES de agir)
    │
    ▼
ARTEFATOS (mockup → user story → arch → tasks → BDD → TDD)
    │
    ▼
APROVAÇÃO HUMANA (/approved)
    │
    ▼
IMPLEMENTAÇÃO (Backend → Integration Doc → Frontend/App)
    │
    ▼
QUALITY GATES (build + test + coverage + score)
    │
    ▼
CODE REVIEW
    │
    ▼
MERGE (via PR, nunca direto)
\`\`\`

---

## 🌿 Git Flow

### Branch Naming

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Feature | \`feature/[ticket]-[descricao]\` | \`feature/PROJ-123-cancelled-tab\` |
| Bug fix | \`fix/[ticket]-[descricao]\` | \`fix/PROJ-456-null-balance\` |
| Hotfix | \`hotfix/[descricao]\` | \`hotfix/payment-crash\` |
| Refactor | \`refactor/[descricao]\` | \`refactor/extract-auth-service\` |

### Commit Messages (Conventional Commits)

\`\`\`
feat: add cancelled refuelings tab
fix: prevent null balance on payment
refactor: extract auth service from user module
docs: update API documentation for v2
test: add integration tests for payment flow
chore: upgrade dependencies
\`\`\`

### Cenários de Git Flow

**Cenário A: Feature nova**
\`\`\`
git checkout develop
git pull origin develop
git checkout -b feature/PROJ-XXX-nome
# ... implementar ...
git add [arquivos específicos]
git commit -m "feat: [descrição]"
git push -u origin feature/PROJ-XXX-nome
# Criar PR para develop
\`\`\`

**Cenário B: Bug fix**
\`\`\`
git checkout develop
git pull origin develop
git checkout -b fix/PROJ-XXX-descricao
# ... corrigir ...
git add [arquivos específicos]
git commit -m "fix: [descrição]"
git push -u origin fix/PROJ-XXX-descricao
# Criar PR para develop
\`\`\`

**Cenário C: Hotfix em produção**
\`\`\`
git checkout main
git pull origin main
git checkout -b hotfix/descricao
# ... corrigir ...
git add [arquivos específicos]
git commit -m "fix: [descrição] (hotfix)"
git push -u origin hotfix/descricao
# Criar PR para main E develop
\`\`\`

---

## 📝 Naming Conventions

${namingConventions}

---

## 🔍 Diagnóstico Obrigatório

> **Antes de QUALQUER implementação, execute este diagnóstico.**

\`\`\`bash
# 1. Entender a estrutura
ls -la src/
find src/ -name "*.${stack.primary === 'Python' ? 'py' : stack.primary === 'Dart' ? 'dart' : 'ts'}" | head -30

# 2. Entender as dependências do módulo
grep -rn "import" --include="*.${stack.primary === 'Python' ? 'py' : 'ts'}" src/[modulo]/ | head -20

# 3. Testes existentes
find . -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" | wc -l

# 4. Score atual
npx @girardelli/architect score .

# 5. Anti-patterns
npx @girardelli/architect anti-patterns .
\`\`\`

---

## ❌ Ações PROIBIDAS

\`\`\`
❌ Commitar direto em main ou develop
❌ Push --force sem aprovação explícita
❌ Merge sem code review
❌ Código sem testes
❌ Ignorar falhas de build/test
❌ Hardcodar secrets, tokens, senhas
❌ console.log / print() em produção
${typeProhibitions}
❌ Testes com .skip() permanente
❌ Copiar/colar código (extrair abstração)
❌ Alterar mais de 10 arquivos sem reavaliar escopo
❌ Implementar sem artefatos aprovados (mockup, US, BDD, TDD)
❌ Decidir arquitetura sem consultar o humano
❌ Refatorar código alheio ao escopo da task
\`\`\`

---

## ✅ Checklist de Compliance (Regras de Ouro)

Antes de marcar QUALQUER tarefa como "done":

\`\`\`
□ Regra 1: Git Flow completo (branch + PR + review)?
□ Regra 2: Arquitetura documentada (C4 se nova feature)?
□ Regra 3: BDD escrito antes do código?
□ Regra 4: TDD aplicado (RED → GREEN → REFACTOR)?
□ Regra 5: Diagnóstico feito antes de codar?
□ Regra 6: Mockup aprovado (se tem UI)?
□ Regra 7: Decisões validadas com humano?
□ Regra 8: Qualidade > Velocidade (sem atalhos)?
□ Regra 9: Apenas código (sem abrir browser, sem screenshots)?
\`\`\`

---

**Gerado por Architect v3.0 · Score: ${report.score.overall}/100 · ${new Date().toISOString().split('T')[0]}**
`;
}

function buildNamingConventions(ctx: TemplateContext): string {
  const { stack } = ctx;
  const lang = stack.primary;

  if (lang === 'Python') {
    return `| Item | Padrão | Exemplo |
|------|--------|---------|
| Classes | PascalCase | \`UserService\` |
| Funções | snake_case | \`get_active_users\` |
| Variáveis | snake_case | \`user_count\` |
| Constantes | UPPER_SNAKE | \`MAX_RETRIES\` |
| Arquivos | snake_case | \`user_service.py\` |
| Módulos | snake_case | \`auth_module/\` |
| Testes | snake_case + \_test | \`user_service_test.py\` |`;
  }

  if (lang === 'Dart') {
    return `| Item | Padrão | Exemplo |
|------|--------|---------|
| Classes | PascalCase | \`UserService\` |
| Funções | camelCase | \`getActiveUsers\` |
| Variáveis | camelCase | \`userCount\` |
| Constantes | camelCase (com const) | \`const maxRetries = 3\` |
| Arquivos | snake_case | \`user_service.dart\` |
| Widgets | PascalCase | \`UserProfileCard\` |
| Testes | snake_case + \_test | \`user_service_test.dart\` |`;
  }

  if (lang === 'Go') {
    return `| Item | Padrão | Exemplo |
|------|--------|---------|
| Types/Structs | PascalCase (exported) | \`UserService\` |
| Functions (public) | PascalCase | \`GetActiveUsers\` |
| Functions (private) | camelCase | \`parseInput\` |
| Variables | camelCase | \`userCount\` |
| Constants | PascalCase | \`MaxRetries\` |
| Files | snake_case | \`user_service.go\` |
| Tests | snake_case + \_test | \`user_service_test.go\` |`;
  }

  // Default: TypeScript/JavaScript
  return `| Item | Padrão | Exemplo |
|------|--------|---------|
| Classes | PascalCase | \`UserService\` |
| Interfaces | PascalCase (sem I prefix) | \`UserPayload\` |
| Funções | camelCase | \`getActiveUsers\` |
| Variáveis | camelCase | \`userCount\` |
| Constantes | UPPER_SNAKE | \`MAX_RETRIES\` |
| Enums | PascalCase | \`UserStatus\` |
| Arquivos | kebab-case | \`user-service.ts\` |
| Módulos (diretório) | kebab-case | \`user-management/\` |
| Testes | kebab-case + .spec/.test | \`user-service.spec.ts\` |
| Entities | PascalCase + .entity | \`User.entity.ts\` |
| DTOs | PascalCase + .dto | \`CreateUserDto\` |
| Controllers | PascalCase + .controller | \`user.controller.ts\` |
| Services | PascalCase + .service | \`user.service.ts\` |`;
}
