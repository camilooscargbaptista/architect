---
antigravity:
  trigger: 'on_demand'
  description: 'Integração CI/CD com verificação de arquitetura'
version: 5.1.0
---

# 🔄 Skill: CI Pipeline — src

> Pipeline de integração contínua com gates de qualidade arquitetural.

---

## GitHub Actions

```yaml
# .github/workflows/architect-ci.yml
name: Architecture CI

on:
  pull_request:
    branches: [main, develop, staging]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Lint
        run: npx eslint .

      - name: Test
        run: npm test

      - name: Coverage
        run: npm run test -- --coverage

      - name: Architecture Score
        run: |
          npm install -g @girardelli/architect
          SCORE=$(architect score . --json | jq '.overall')
          echo "Architecture Score: $SCORE/100"
          if [ "$SCORE" -lt 70 ]; then
            echo "::error::Score ($SCORE) below threshold (70)"
            exit 1
          fi

      - name: No Score Regression
        run: |
          # Compare with main branch score
          CURRENT=$(architect score . --json | jq '.overall')
          echo "Current: $CURRENT/100, Minimum: 70/100"
```

---

## Comandos do Pipeline

| Step | Comando | Gate |
|------|---------|------|
| Install | `npm install` | — |
| Build | `npm run build` | ❌ Bloqueia se falhar |
| Lint | `npx eslint .` | ❌ Bloqueia se falhar |
| Test | `npm test` | ❌ Bloqueia se falhar |
| Coverage | `npm run test -- --coverage` | ⚠️ Mínimo 80% |
| Score | `architect score .` | ❌ Mínimo 70/100 |

---

## GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - quality

build:
  stage: build
  script:
    - npm install
    - npm run build

test:
  stage: test
  script:
    - npm test
    - npm run test -- --coverage

architecture:
  stage: quality
  script:
    - npm install -g @girardelli/architect
    - architect score . --json
  allow_failure: false
```

---

**Gerado por Architect v5.1 · Score: 83/100**
