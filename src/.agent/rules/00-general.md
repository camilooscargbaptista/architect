---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras gerais invioláveis para src'
  priority: CRITICAL
---

# 📜 Regras Gerais — src

> **Estas regras são INVIOLÁVEIS. Não há exceção.**

---

## 🏆 Regras de Ouro

```
╔══════════════════════════════════════════════════════════════╗
║                    9 REGRAS DE OURO                         ║
║                                                              ║
║  1. Git Flow completo (branch → PR → review → merge)       ║
║  2. Arquitetura C4 (4 níveis de documentação)              ║
║  3. BDD antes de código                                    ║
║  4. TDD — Red → Green → Refactor                           ║
║  5. Diagnóstico obrigatório antes de codar                 ║
║  6. Mockup antes de qualquer UI                            ║
║  7. Nunca decidir sozinho — perguntar ao humano            ║
║  8. Qualidade > Velocidade                                 ║
║  9. Não abrir browser, não tirar screenshot — apenas código║
║                                                              ║
║  ⚠️  Violar qualquer regra = PARAR e RECOMEÇAR              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🏢 Identidade do Projeto

| Item | Valor |
|------|-------|
| **Nome** | src |
| **Stack** | TypeScript + JavaScript |
| **Score** | 83/100 |
| **Linguagens** | TypeScript, JavaScript |
| **Frameworks** | Nenhum detectado |
| **Cobertura Mínima** | 80% |
| **Score Mínimo** | 70/100 |

---

## 🔄 Fluxo Completo (Qualquer Ação)

```
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
```

---

## 🌿 Git Flow

### Branch Naming

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Feature | `feature/[ticket]-[descricao]` | `feature/PROJ-123-cancelled-tab` |
| Bug fix | `fix/[ticket]-[descricao]` | `fix/PROJ-456-null-balance` |
| Hotfix | `hotfix/[descricao]` | `hotfix/payment-crash` |
| Refactor | `refactor/[descricao]` | `refactor/extract-auth-service` |

### Commit Messages (Conventional Commits)

```
feat: add cancelled refuelings tab
fix: prevent null balance on payment
refactor: extract auth service from user module
docs: update API documentation for v2
test: add integration tests for payment flow
chore: upgrade dependencies
```

### Cenários de Git Flow

**Cenário A: Feature nova**
```
git checkout develop
git pull origin develop
git checkout -b feature/PROJ-XXX-nome
# ... implementar ...
git add [arquivos específicos]
git commit -m "feat: [descrição]"
git push -u origin feature/PROJ-XXX-nome
# Criar PR para develop
```

**Cenário B: Bug fix**
```
git checkout develop
git pull origin develop
git checkout -b fix/PROJ-XXX-descricao
# ... corrigir ...
git add [arquivos específicos]
git commit -m "fix: [descrição]"
git push -u origin fix/PROJ-XXX-descricao
# Criar PR para develop
```

**Cenário C: Hotfix em produção**
```
git checkout main
git pull origin main
git checkout -b hotfix/descricao
# ... corrigir ...
git add [arquivos específicos]
git commit -m "fix: [descrição] (hotfix)"
git push -u origin hotfix/descricao
# Criar PR para main E develop
```

---

## 📝 Naming Conventions

| Item | Padrão | Exemplo |
|------|--------|---------|
| Classes | PascalCase | `UserService` |
| Interfaces | PascalCase (sem I prefix) | `UserPayload` |
| Funções | camelCase | `getActiveUsers` |
| Variáveis | camelCase | `userCount` |
| Constantes | UPPER_SNAKE | `MAX_RETRIES` |
| Enums | PascalCase | `UserStatus` |
| Arquivos | kebab-case | `user-service.ts` |
| Módulos (diretório) | kebab-case | `user-management/` |
| Testes | kebab-case + .spec/.test | `user-service.spec.ts` |
| Entities | PascalCase + .entity | `User.entity.ts` |
| DTOs | PascalCase + .dto | `CreateUserDto` |
| Controllers | PascalCase + .controller | `user.controller.ts` |
| Services | PascalCase + .service | `user.service.ts` |

---

## 🔍 Diagnóstico Obrigatório

> **Antes de QUALQUER implementação, execute este diagnóstico.**

```bash
# 1. Entender a estrutura
ls -la src/
find src/ -name "*.ts" | head -30

# 2. Entender as dependências do módulo
grep -rn "import" --include="*.ts" src/[modulo]/ | head -20

# 3. Testes existentes
find . -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" | wc -l

# 4. Score atual
npx @girardelli/architect score .

# 5. Anti-patterns
npx @girardelli/architect anti-patterns .
```

---

## ❌ Ações PROIBIDAS

```
❌ Commitar direto em main ou develop
❌ Push --force sem aprovação explícita
❌ Merge sem code review
❌ Código sem testes
❌ Ignorar falhas de build/test
❌ Hardcodar secrets, tokens, senhas
❌ console.log / print() em produção
❌ any (TypeScript) sem justificativa em comentário
❌ @ts-ignore / type: ignore sem justificativa
❌ Testes com .skip() permanente
❌ Copiar/colar código (extrair abstração)
❌ Alterar mais de 10 arquivos sem reavaliar escopo
❌ Implementar sem artefatos aprovados (mockup, US, BDD, TDD)
❌ Decidir arquitetura sem consultar o humano
❌ Refatorar código alheio ao escopo da task
```

---

## ✅ Checklist de Compliance (Regras de Ouro)

Antes de marcar QUALQUER tarefa como "done":

```
□ Regra 1: Git Flow completo (branch + PR + review)?
□ Regra 2: Arquitetura documentada (C4 se nova feature)?
□ Regra 3: BDD escrito antes do código?
□ Regra 4: TDD aplicado (RED → GREEN → REFACTOR)?
□ Regra 5: Diagnóstico feito antes de codar?
□ Regra 6: Mockup aprovado (se tem UI)?
□ Regra 7: Decisões validadas com humano?
□ Regra 8: Qualidade > Velocidade (sem atalhos)?
□ Regra 9: Apenas código (sem abrir browser, sem screenshots)?
```

---

**Gerado por Architect v3.1 · Score: 83/100 · 2026-03-31**
