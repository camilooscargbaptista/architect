---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras de arquitetura para @girardelli/architect'
  priority: HIGH
---

# 🏗️ Regras de Arquitetura — @girardelli/architect

> **Separação de camadas, direção de dependências, e padrões de módulo.**

---

## 📐 Camadas Arquiteturais

| Camada | Responsabilidade | Padrão |
|--------|-----------------|--------|
| **API / Controllers** | Routing, validação HTTP | controllers/ |
| **Service** | Lógica de negócio | services/ |
| **Data / Repository** | Acesso a dados | repositories/ |
| **Entity / Model** | Modelo de domínio | entities/ ou models/ |
| **DTO / Schema** | Contratos I/O | dto/ ou schemas/ |

### Direção de Dependência (OBRIGATÓRIA)

```
UI / Controllers  →  Services  →  Repositories / Data  →  Entities
       ↓                ↓                 ↓
   (pode usar)     (pode usar)      (pode usar)
   Services        Repositories     Entities
   DTOs            Entities         Value Objects
                   DTOs

⚠️  NUNCA:
   Entity → Controller
   Repository → Controller
   Service → Controller
   Data Layer → UI Layer
```

### Regra de Ouro das Camadas

```
╔══════════════════════════════════════════════════════╗
║  Uma camada SÓ pode depender de camadas ABAIXO.     ║
║  NUNCA de camadas acima ou da mesma camada lateral. ║
╚══════════════════════════════════════════════════════╝
```

---

## 📦 Padrão de Módulo

```
src/modules/[nome-do-modulo]/
├── [nome].module.ts
├── [nome].controller.ts  → Endpoints / API
├── [nome].service.ts     → Lógica de negócio
├── dto/                       → Request/Response shapes
├── entities/                  → Modelos de domínio
└── __tests__/                 → Testes do módulo
```

---

## 🚫 Anti-Patterns a Prevenir

### God Class (> 500 linhas ou > 10 métodos)
```
❌ PROIBIDO: Classe com múltiplas responsabilidades
✅ CORRETO: Extrair em classes menores com responsabilidade única

Se um arquivo ultrapassar 500 linhas:
1. PARAR
2. Identificar responsabilidades distintas
3. Extrair em módulos separados
4. Atualizar imports
```

### Circular Dependencies
```
❌ PROIBIDO: A importa B, B importa A
✅ CORRETO: Extrair interface comum ou usar event/mediator

Detecção:
$ npx madge --circular src/
$ architect anti-patterns .
```

### Leaky Abstractions
```
❌ PROIBIDO: Service expondo detalhes de implementação
✅ CORRETO: Interface define contrato, implementação é encapsulada

Exemplos:
- Service retornando QueryBuilder → ERRADO (vaza ORM)
- Service retornando DTO → CORRETO (abstrai)
- Controller acessando Entity → ERRADO (vaza modelo)
- Controller acessando DTO → CORRETO (contrato)
```

### Feature Envy
```
❌ PROIBIDO: Método que usa mais atributos de outra classe que da própria
✅ CORRETO: Mover método para a classe que possui os dados
```

### Shotgun Surgery
```
❌ PROIBIDO: Mudança em 1 feature exige alterar 10+ arquivos
✅ CORRETO: Agrupar código relacionado no mesmo módulo

Se uma mudança toca > 5 arquivos:
1. PARAR
2. Reavaliar se o código está no lugar certo
3. Considerar refatoração preventiva
```

---

## 🏛️ Princípios Arquiteturais

### DDD (Domain-Driven Design) — Quando Aplicável
```
Entities:       Objetos com identidade (ID único)
Value Objects:  Objetos sem identidade (imutáveis)
Aggregates:     Cluster de entidades com root
Repositories:   Acesso a dados de Aggregates
Services:       Lógica que não pertence a nenhuma entidade
```

### Clean Architecture
```
Camada mais interna: Entities (regras de negócio)
Camada média:        Use Cases / Services (lógica de aplicação)
Camada externa:      Controllers, Gateways, Presenters (I/O)

Dependência: SEMPRE de fora para dentro, NUNCA o contrário.
```

### Event-Driven — Quando Aplicável
```
Usar eventos quando:
- Desacoplamento entre módulos é necessário
- Processamento assíncrono é aceitável
- Múltiplos handlers para um mesmo trigger

NÃO usar eventos quando:
- Resposta síncrona é necessária
- Transação atômica é obrigatória
- Ordem de execução importa
```

---

## 📊 Anti-Patterns Atuais do Projeto

✅ Nenhum anti-pattern detectado. Manter assim.

Score atual: **94/100** | Meta: **100/100**

---

## ✅ Checklist de Arquitetura

Antes de criar qualquer módulo novo:

```
□ Camada correta? (Controller vs Service vs Repository vs Entity)
□ Direção de dependência respeitada? (nunca de baixo para cima)
□ Módulo coeso? (tudo relacionado junto)
□ Sem circular dependency?
□ Sem God Class? (< 500 linhas, < 10 métodos)
□ Interface/abstração antes de implementação?
□ DTOs para comunicação entre camadas?
□ Testes por camada? (unit para service, integration para controller)
```

---

**Gerado por Architect v3.1 · Score: 94/100**
