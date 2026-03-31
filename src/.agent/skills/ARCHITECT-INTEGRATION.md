---
antigravity:
  trigger: 'on_demand'
  description: 'Como usar o Architect para análise contínua de arquitetura'
version: 5.1.0
---

# 🏗️ Skill: Architect Integration — src

> Como usar `@girardelli/architect` para manter a qualidade arquitetural.

---

## Instalação

```bash
npm install -g @girardelli/architect
```

---

## Comandos Disponíveis

### Análise completa
```bash
# Gera HTML report + JSON + .agent/ framework
architect analyze .

# Output:
#   → architect-report.html (visual)
#   → architect-report.json (dados)
#   → .agent/ (framework de agentes)
```

### Score rápido
```bash
# Verificação rápida do score
architect score .

# JSON output (para CI)
architect score . --json
```

### Regenerar agentes
```bash
# Regenera .agent/ com dados atualizados
architect agents .
```

---

## Estado Atual — src

| Métrica | Valor |
|---------|-------|
| **Score** | 83/100 |
| **Meta** | 70/100 (mínimo) |
| **Score Modularity** | 85/100 |
| **Score Coupling** | 65/100 |
| **Score Cohesion** | 100/100 |
| **Score Layering** | 85/100 |
| **Anti-patterns** | 21 |
| **Arquivos** | 122 |
| **Linhas** | 21,138 |

---

## Integração no Workflow

### Antes de criar PR
```bash
# Verificar que o score não regrediu
architect score .
# Se score < 70 → NÃO criar PR
```

### Após refatoração
```bash
# Verificar melhoria
architect analyze .
# Comparar com score anterior
```

### Revisão de arquitetura
```bash
# Gerar report completo para code review
architect analyze . --output-dir docs/
```

---

## Quality Gates

```
Score mínimo para PR:       70/100
Cobertura mínima:           80%
Zero anti-patterns CRITICAL: Obrigatório
Regressão de score:         Proibida
```

---

**Gerado por Architect v5.1 · Score: 83/100**
