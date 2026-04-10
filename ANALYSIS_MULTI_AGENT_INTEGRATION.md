# Architect v3.1 — Análise Crítica Profunda + Plano de Integração Multi-Agente

**Autor:** análise técnica conduzida em 2026-04-10
**Escopo:** auditoria honesta do estado atual + proposta de evolução para agent teams
**Tom:** sem panos quentes. Se dói, é porque precisa doer para endireitar.

---

## 0. TL;DR executivo

O `architect` é um projeto **bem mais maduro do que a maioria dos side-projects de CTO**, com estrutura limpa, cobertura crescente, e uma ambição interessante: ser *a* ferramenta que analisa um repositório, detecta padrões, e gera **documentação de governança para agentes de IA** customizada ao stack.

Mas o projeto vive uma **tensão de identidade não resolvida**: ele se vende como ferramenta de análise arquitetural (scorer + anti-patterns + diagramas), e ao mesmo tempo como gerador de "context-aware agents". A primeira metade é um **analisador estático regex-based com heurísticas frouxas**, e a segunda é um **sistema de templates markdown** muito bonito que *não* é um runtime de agentes — apenas produz arquivos `.md` que um humano leva para o Claude Code.

As duas metades, juntas, compõem um produto que **escreve cheques que o código não sabe descontar**. O README fala em "context-aware", "61 frameworks", "domain inference", e na prática cada uma dessas capacidades é frágil: o scorer tem fórmula arbitrária, a detecção de anti-patterns é regex que quebra em TypeScript moderno, e o "agent-generator" gera descrições narrativas, não contratos executáveis.

A boa notícia: **esses problemas são corrigíveis e o roadmap tem uma oportunidade grande**. O commit `a216e40` já menciona "v4.0 roadmap (agent runtime with I/O contracts)". Perfeito — é exatamente para lá que o projeto precisa ir. Este documento propõe um caminho concreto e priorizado, e mostra como integrar multi-agente *dentro* do próprio architect (tanto para melhorar a análise quanto para evoluir o agent-generator de "gerador de docs" para "gerador de runtime real").

---

## 1. O que está bom (dê crédito onde é devido)

Não é só crítica. Há fundamentos sólidos:

**Estrutura e organização.** `src/` está limpo, módulos têm SRP razoável (scanner, analyzer, scorer, diagram, reporter), tipos em `types.ts`, config centralizada em `config.ts`. Não há jeito amador tipo pasta `utils/` gigante ou `helpers.ts` de 3000 linhas. Para um projeto de 8229 linhas de TS em 20 arquivos, a densidade de responsabilidade é saudável.

**Stack enxuta e moderna.** Apenas 2 dependências de runtime (`glob`, `acorn`). Node 18+, TS 5.3 strict, ESM nativo, module resolution "bundler". Isso é raro e é *correto*. Muitos projetos desse porte acumulam 30 deps porque alguém quis usar 3 delas; aqui há disciplina.

**Detecção de ciclos funciona.** `analyzer.ts:92-115` implementa DFS + recursion stack clássico. É correto. Não é excitante, mas é o tipo de código que você quer: simples, testável, rodando.

**Progresso de testes é visível e real.** Git log mostra uma onda recente de `test(scorer)`, `test(context-enricher)`, `test(framework-detector)`, `test(template-helpers)` com coberturas específicas declaradas (scorer saiu de 58% para 100% statements / 97% branches; context-enricher 67% → 84%). Isso não é postura — é trabalho. Merece crédito.

**Separação CLI ↔ core.** `cli.ts` tem uma `ProgressReporter` coesa que não vaza para dentro do `Architect` core. O core emite eventos via callback e o CLI decide como renderizar. Esse desacoplamento é um ativo arquitetural que vai valer ouro quando virar runtime de agentes.

**Commit hygiene.** Mensagens de commit são estruturadas (`feat(enricher)`, `fix(cli)`, `test(scorer)`), descritivas, com corpo explicando *por quê*. Co-autorias com Claude declaradas. Histórico é legível e revela intenção — quem for contratar ou contribuir consegue entender a trajetória.

**Framework detection cobre território legítimo.** O `framework-detector.ts` (669 linhas) identifica genuinamente 61 frameworks em múltiplos ecossistemas com versões. Não é só um `switch` de strings — há parsing de `package.json`, `pyproject.toml` (PEP 621 inline), `go.mod`, etc. Esse é um dos ativos mais reais do projeto.

**Templates de governança são pensados.** O conjunto de templates em `agent-generator/templates/` (core/stack/domain) cobre ADR, BDD, TDD, C4, Threat Model, golden rules, approval gates, quality gates. Do ponto de vista de *documentação de governança*, é um trabalho carinhoso. Como starting point para um time que quer padronizar, entrega valor de verdade.

---

## 2. O que está ruim (e ainda não dá vergonha)

**God class no `Architect` orquestrador.** `src/index.ts:38-154` — o método `analyze()` executa sete fases sequenciais inline num único método gigante. Cada fase deveria ser sua própria unidade com entrada/saída explícita. Hoje, se você quiser adicionar uma fase ou rodar duas em paralelo, você reescreve o método inteiro. Não há `Pipeline` ou `Phase` como abstração — é uma sequência de chamadas.

**Re-execução absurda do pipeline.** `index.ts:239-265` — os métodos `score()`, `antiPatterns()`, `layers()` cada um chama `analyze()` inteiro por baixo, sem cache. Se alguém (ou um agente) chamar os três em sequência, o projeto é escaneado, parseado, analisado e pontuado **três vezes**. Zero memoização entre chamadas. Para um projeto com 5000 arquivos, isso é latência multiplicada por 3 e custo de I/O triplicado sem motivo.

**Dependências computadas duas vezes.** `index.ts:57-73` — `analyzer.analyzeDependencies(...)` é chamado, o resultado é reduzido em um Map, e logo abaixo a *mesma função* é chamada de novo para obter `edges`. O resultado da primeira chamada não é guardado. É O(n²) onde deveria ser O(n), e é o tipo de smell que um linter não pega mas um reviewer atento sim.

**CLI parsing artesanal e frágil.** `cli.ts:267-276` — parsing de args com `args.indexOf('--format')` + `args[formatIdx + 1]` sem checar bounds. Não suporta `--format=html`. Não valida se `args[formatIdx + 1]` é um valor ou outro flag. O único motivo de não haver um bug reportado é que ninguém chama a CLI errado ainda. Substituir por `commander` ou `citty` é trabalho de 30 minutos e elimina uma categoria inteira de issues futuros.

**Sem validação de paths.** `cli.ts:275` — `resolve(pathArg)` é chamado sem verificar se o path existe, se é diretório, se é legível. Os writes de saída (`:348`, `:354`, `:360`) não criam diretórios pais, não verificam permissão de escrita. Primeiro usuário que rodar em path inválido vai receber stack trace críptico.

**Sem cancelamento ou timeout.** Não há `AbortSignal` em lugar nenhum. Se o scanner travar num symlink recursivo ou num monorepo de 50k arquivos, não há jeito de parar sem `Ctrl+C` hard. Para uma ferramenta que vai virar backend de workflows e agentes, isso é bloqueador.

**Progress callback sem proteção.** `index.ts:39` — `const emit = onProgress || (() => {})`. Se um `onProgress` passado por consumidor externo lançar exceção, isso derruba o orquestrador inteiro no meio da pipeline. Um `try/catch` local em volta do `emit()` é um patch de 4 linhas.

**Stack detector redundante com framework detector.** `agent-generator/stack-detector.ts` usa extensão de arquivo + padrão de nome (103 linhas). `framework-detector.ts` lê `package.json`, `pyproject.toml`, `go.mod` (669 linhas). São dois detectores resolvendo problemas sobrepostos, e o primeiro é o mais fraco. O framework-detector já *é* um stack-detector superior — consolidar.

**Acoplamento interno no agent-generator.** O `index.ts` do agent-generator (`getTemplateFor()`, linha 382) é um `if` gigante mapeando nome de arquivo → função template. Cada template novo = novo `if`. Qualquer mudança em `template-helpers.ts` ripple em 12 templates. É feature, não bug — mas dá pra fazer via registry pattern ou discovery por convenção de nome.

**HTML reporter é um arquivo de 1830 linhas com HTML, CSS e JS do D3 tudo inline como template string.** Já discutiremos na próxima seção; aqui fica registrado que é o maior ativo técnico em débito.

---

## 3. O que faz passar vergonha (os piores offenders)

Aqui é onde dói. São coisas que, se um reviewer externo visse, levantaria a sobrancelha. Não é catástrofe — mas em uma ferramenta que se propõe a *auditar* arquitetura de terceiros, a barra precisa ser mais alta.

### 3.1. O scorer é uma fórmula arbitrária dando nota de autoridade

`src/scorer.ts` produz uma nota "72/100" que aparece no README, nas capturas de exemplo, e na comunicação do produto. Olhando o código:

```typescript
// scorer.ts ~linhas 82-101 (modularity)
avgEdgesPerFile < 2  → 95
avgEdgesPerFile < 4  → 85
avgEdgesPerFile < 10 → 50
```

Por que 2? Por que 4? Por que 10? **Não há citação, não há calibração empírica, não há justificativa.** São breakpoints inventados. Um projeto novinho com zero dependências tira 95 em modularidade por ser vazio. Um monorepo grande e bem-estruturado, onde cada arquivo naturalmente depende de 5–7 outros, tira 50 e é condenado como "fracamente modular".

Pior: a nota de `layering` depende do número de anti-patterns detectados como "Leaky Abstraction" (linha ~216-237). Como os detectores são fracos (seção 3.2), eles raramente disparam, então `layering` tende a 95 por padrão. **Detectores ruins → scores altos → ferramenta ruim dizendo que tudo vai bem.** É um loop circular disfarçado de métrica.

O número "72/100" no exemplo do README não significa nada. Um cliente que veja esse número e tome decisão de refatoração baseada nele está sendo enganado pelo teatro da quantificação. Isso é o que faz passar vergonha.

**Correção:** ou você remove o score numérico e volta a ser qualitativo ("bom/atenção/crítico" por dimensão), ou você calibra com um dataset de 100+ projetos reais cruzados com indicadores de saúde (bug density, velocity, developer surveys). A segunda é trabalho sério; a primeira é honestidade imediata.

### 3.2. Detectores de anti-patterns são regex, não AST

O projeto **já tem acorn como dependência** (`package.json`). E mesmo assim, `anti-patterns.ts:216-227` conta métodos com regex:

```typescript
/(?:async\s+)?(?:function|public|private|protected|static)\s+\w+\s*\(/g;
```

Esse regex **não detecta**:
- Getters/setters (`get foo() {}`)
- Private fields modernos (`#method() {}`)
- Arrow methods em class fields (`foo = () => {}`)
- Métodos dentro de template literals ou comentários — conta falsos positivos
- Overloads de TypeScript
- Construtores sem `function`

Uma classe de React Hooks com `foo = useCallback(() => {})` como campo nunca é contada. Uma classe Vue com `computed` não é contada. O teu próprio `html-reporter.ts` provavelmente é sub-contado pelos seus próprios detectores.

`countInternalExports()` usa regex ainda mais frágil procurando por `export` + palavras-chave. Um `export interface InternalApiResponse {}` dispara falso positivo de "leaky abstraction". Um módulo com convenção diferente (nomenclatura sem `Internal_`) passa batido.

`feature envy` (`anti-patterns.ts:168`) compara `externalMethodCalls > internalMethods * 3` onde `externalMethodCalls` é **o número de arquivos dos quais o módulo importa**, não chamadas reais de método. Um módulo que importa `import { z } from 'zod'` conta igual a um que chama 20 métodos de outra classe. **O nome da métrica não bate com a métrica calculada.**

Você tem acorn instalado. Você **precisa** usar acorn para TS/JS, e `tree-sitter` ou equivalente para as outras linguagens suportadas. Regex para análise estática de código moderno é 2010. Isso é vergonha porque o marketing do projeto é "analisa arquitetura" — se a análise é regex, o produto mente.

### 3.3. Detecção de camadas por nome de pasta

`analyzer.ts:268-395` (categorizeFiles): checklist de strings em paths.

```typescript
if (path.includes('/entities/') || name.endsWith('.entity.ts')) → Data
if (path.includes('/controllers/')) → API
```

Funciona para NestJS porque NestJS tem convenções rígidas. **Quebra para tudo mais.** Um projeto React hooks-based não tem `/services/`. Um projeto Go bem estruturado tem `/internal/repository/` (não reconhecido). Um projeto Elixir (Phoenix) tem `/lib/my_app_web/` — zero match. Um projeto Python FastAPI com `routers/` — nada.

Pior ainda: a ordem dos checks (linha 280-334) garante que "Data layer check first" — um arquivo em `/entities/` nunca será reclassificado, mesmo que seu conteúdo seja um service com 20 métodos de lógica de negócio. A heurística é cega para o código.

O resultado é que a "layered architecture detection" funciona em projetos que *já seguem* uma convenção NestJS/Spring-like — justamente os projetos que menos precisam de auditoria. Em tudo o mais, o output é ruído.

### 3.4. Scanner ignora `.gitignore` real

`scanner.ts:83-91` usa `ignore: ignorePatterns` vindos de `config.ignore`, não do `.gitignore` do projeto analisado. Então se o projeto tem `dist/`, `build/`, `coverage/` em `.gitignore`, o architect analisa tudo isso como se fosse código-fonte do usuário. Falsos positivos disparando por todo lado, dependências inchadas, scores distorcidos.

Corrigir isso é ler o `.gitignore` com uma lib (`ignore` do npm, 3 linhas) e combinar com os patterns default. É trabalho de uma hora. Hoje, rodar o architect no teu próprio projeto provavelmente analisa `dist/` inteiro se `config.ignore` não estiver certo — e esse é o tipo de coisa que um usuário descobre e perde a confiança.

### 3.5. Scanner carrega arquivos binários em memória como UTF-8

`scanner.ts:~289` — `content.split('\n').length` assume UTF-8. Se houver um `.png`, `.jar`, `.bin` no caminho e a config de ignore não pegar, o `readFileSync` carrega o binário inteiro na memória e depois tenta split. Em projetos de ML ou com assets, isso pode estourar memória ou degradar drasticamente.

Fix: detectar por magic bytes ou por extensão + MIME, e só ler como texto o que for texto.

### 3.6. HTML reporter: 1830 linhas, HTML+CSS+JS inline, XSS inconsistente

`html-reporter.ts` (1830 linhas) tem:
- Estrutura HTML completa como string template (linhas 13-87)
- 600+ linhas de D3.js inline como template string (linhas 751-1000+)
- ~850 linhas de CSS embutida em `getStyles()` (linhas 1327+)
- Método `escapeHtml()` existe **mas não é usado consistentemente**

O último ponto é sério. Linhas como `a.name`, `a.description` aparecem em atributos `data-*` e em innerHTML sem passar por `escapeHtml`. Se uma dependência do projeto analisado tiver um nome contendo aspas ou `<script>`, você tem **XSS refletido**. O cenário é: desenvolvedor roda `architect` contra um projeto que puxa uma dep maliciosa do npm → o nome da dep vai parar no HTML → abre o relatório no browser → executa JS arbitrário no contexto do `file://` local.

Não é XSS de produção web, mas é um tipo de problema que um *auditor de segurança ou tech debt* vai pegar numa olhada de 5 minutos. Para uma ferramenta que analisa segurança indiretamente (detecta anti-patterns), cair em XSS básico é constrangedor.

Adicionalmente: 1830 linhas concatenando HTML + CSS + JS numa única classe **é impossível de testar unitariamente**. Não há testes para o html-reporter (confirmado pelo worker de quality), e não dá para escrever testes razoáveis enquanto o arquivo estiver nesse formato.

### 3.7. Re-análise e ausência de cache tornam o architect incapaz de ser um backend

Pense no futuro: você quer que o `architect` vire serviço, ou API, ou um MCP server que agentes consultem. Hoje, isso é inviável porque:
- Cada chamada a `score()` ou `antiPatterns()` roda o pipeline do zero
- Não há identidade de projeto (hash, fingerprint, versão de análise)
- Não há invalidação incremental — um arquivo muda, reanalisa tudo
- Não há paralelismo nas fases

Para virar serviço, você precisa de `AnalysisContext` imutável, cacheado por hash de conteúdo, com invalidação por arquivo. Isso é refactor grande mas absolutamente necessário. Hoje, o architect é uma CLI batch, não um analisador interativo.

---

## 4. Análise crítica do `agent-generator` (o elefante na sala)

O `agent-generator` é onde o projeto tem mais ambição e, por isso, é onde a distância entre marketing e realidade é maior. Separei a análise dele porque é o ponto em que a integração multi-agente vai acontecer.

### 4.1. O que o agent-generator *é*, de fato

É um **pipeline de composição de templates markdown** que:

1. Lê uma `AnalysisReport` (resultado do scanner/analyzer).
2. Enriquece contexto via `ContextEnricher`, `DomainInferrer`, `FrameworkDetector`.
3. Seleciona templates de `core/`, `stack/`, `domain/`.
4. Interpola variáveis nas templates e concatena.
5. Escreve 20–30 arquivos `.md` em `.agent/` no projeto alvo.

**Não há runtime.** Os arquivos gerados são lidos posteriormente por humanos no Claude Code, Cursor, ou equivalente. O próprio projeto não executa nem orquestra agentes. Isso é o ponto crucial que o README esconde quando fala em "context-aware agents" — sugere que há agentes *ativos*, quando na verdade há *descrições* de agentes.

Não tem nada de errado em gerar documentação de governança. **Só precisa estar claro que é isso que é.** O commit `a216e40` já registra isso ao mencionar "v4.0 roadmap: agent runtime with I/O contracts" — o autor sabe que falta um runtime. Perfeito. Precisa executar.

### 4.2. O que está bom aqui

O pipeline de enriquecimento tem boas ideias:

- `DomainInferrer` classifica o projeto em 10+ domínios (fintech, healthtech, e-commerce, saas) usando keywords de nomes de arquivos, paths, README.
- `ContextEnricher` tenta extrair módulos via 6 estratégias com fallback (markers explícitos → clean architecture → Django apps → Java packages → Go packages → default). É pragmático.
- `FrameworkDetector` parseia `pyproject.toml` (PEP 621), `package.json`, `go.mod` e extrai versões reais. É o componente mais sério do módulo.
- Templates cobrem uma superfície enorme: ADR, BDD, TDD, C4, Threat Model, Preflight Checklist, Golden Rules, 10+ specializations de agentes.

Se o objetivo fosse *"gerar o `.agent/` inicial para um time padronizar sua governança com Claude Code"*, o produto entrega.

### 4.3. Onde é superficial

**Os "agentes" gerados não têm contrato.** Um `BACKEND-DEVELOPER.md` gerado lista `capabilities: [api-design, service-architecture, ...]` em YAML frontmatter, mas **não define**:

- Quais inputs o agente aceita (schema JSON? texto livre?)
- Quais outputs ele produz (arquivos? JSON estruturado? PR?)
- Quais ferramentas ele pode invocar (shell? git? testes? qual CLI?)
- Quais guardrails o impedem de agir (permissões de escrita? paths proibidos? budget de tokens?)
- Como ele falha (quando retorna erro? quando escala para humano?)

Sem isso, um "agente" é um prompt com nome bonito. Um agente de verdade é um *contrato de I/O ferramentado*.

**Os "workflows" são markdown narrativos.** Um `new-feature.md` tem 10 steps e checkboxes de aprovação (`□ Human reviewed`). Não há state machine, não há blocking logic, não há como outro sistema consumir e executar. É documentação de processo, não processo.

**Os "approval gates" são cosmetic.** `□ Code review below threshold` é texto. Um gate de verdade é:

```typescript
if (coverage < 0.80) return { status: 'BLOCKED', reason: 'Coverage < 80%' }
```

Hoje não há nada disso — é todo descritivo.

**Endpoint discovery é superficial.** O `ContextEnricher` tenta gerar listas de endpoints como "GET /{resource}, POST /{resource}" via padrões CRUD genéricos. Não lê decorators reais (`@GetMapping`, `@app.get`), não lê OpenAPI specs se existirem, não resolve rotas dinâmicas. Em um projeto real com rotas customizadas, a lista gerada é fantasia.

**Domain inference é keyword matching.** Se um projeto tem `payment`, `billing`, `invoice` em nomes de arquivos, vira "fintech". Não olha schemas de banco, não olha entidades, não olha integrações reais. É um classificador de palavra-chave, não de estrutura.

**Stack detector e framework detector duplicam trabalho.** O `StackDetector` (103 linhas) detecta por extensão + padrão de nome. O `FrameworkDetector` (669 linhas) faz algo muito mais rico lendo configs reais. Os dois coexistem; o primeiro deveria ser deletado e substituído pelo segundo.

### 4.4. Veredicto do agent-generator

Como **gerador de starter-kit de governança para times usarem com Claude Code**, é competente e útil. Como **sistema de agentes**, não é um. E o jeito como é apresentado no README cria expectativas que o código não cumpre. A correção é dupla:

1. **Verdade em rotulagem.** Chamar o que existe hoje de `governance-scaffolder` ou `agent-docs-generator`, não de agent-generator. Isso é marketing honesto.
2. **Construir o runtime de verdade.** É o que a próxima seção propõe.

---

## 5. Plano de integração multi-agente no `architect`

Aqui é a parte construtiva. A ideia é dupla: **usar agent teams para melhorar o próprio architect** (architect como *consumidor* de multi-agente) e **evoluir o agent-generator para um runtime real** (architect como *criador* de multi-agente).

Estas duas frentes avançam em paralelo e se reforçam: quanto melhor o runtime, mais o architect internamente se beneficia dele; quanto mais o architect usa multi-agente internamente, mais aprendizado flui para o runtime gerado.

### 5.1. Frente A — Architect como consumidor de agent teams

O objetivo é substituir a análise monolítica single-threaded de hoje por uma orquestração multi-agente que seja mais rápida, mais profunda, e mais honesta sobre incerteza.

**5.1.1. Refatorar `Architect` de god class para `AnalysisOrchestrator`.** Extrair cada fase (scan, dependency-graph, anti-patterns, scoring, layering, summarization, refactor, agent-generation) em uma interface `AnalysisPhase<TIn, TOut>` com contrato explícito de entrada/saída. O orchestrator vira um dispatcher que sabe qual fase depende de qual, e pode rodar fases independentes em paralelo.

Concretamente, em pseudocódigo:

```typescript
interface AnalysisPhase<TIn, TOut> {
  name: string
  inputs: (keyof AnalysisContext)[]
  run(ctx: AnalysisContext, input: TIn, signal: AbortSignal): Promise<TOut>
}

class AnalysisOrchestrator {
  constructor(private phases: AnalysisPhase<any, any>[]) {}

  async run(projectPath: string, opts: RunOpts): Promise<AnalysisReport> {
    const ctx = new AnalysisContext(projectPath)
    const graph = buildDependencyGraph(this.phases)
    for (const batch of topologicalBatches(graph)) {
      // batch = fases independentes → Promise.all em paralelo
      await Promise.all(batch.map(phase => this.runPhase(phase, ctx, opts.signal)))
    }
    return ctx.toReport()
  }
}
```

Isso resolve 5 problemas de uma vez: god class, re-execução sem cache, ausência de cancelamento, ausência de paralelismo, e a impossibilidade de adicionar novas fases sem tocar no núcleo.

**5.1.2. Introduzir cache por hash de conteúdo em `AnalysisContext`.** Cada arquivo fonte tem um hash SHA-256. Cada fase é idempotente sobre um subconjunto de arquivos. O cache mapeia `(phase_name, file_hash_set) → output`. Invalida só o que mudou. Para CLI batch é ganho moderado; para quando o architect virar MCP server ou backend de IDE, é vital.

**5.1.3. Rodar análise como uma orquestração de "specialist workers".** Hoje `anti-patterns.ts` é um detector monolítico. Proposta: cada anti-pattern vira um *worker especialista* (detector plugável), e o orchestrator dispara todos em paralelo sobre o mesmo `DependencyGraph` imutável. Cada worker retorna um relatório estruturado com confidence score. O orchestrator agrega.

Isso não é só performance — é **honestidade epistêmica**. Cada worker pode declarar "confidence: low" quando não tem certeza (por exemplo, quando roda em um .py sem AST TypeScript e tem que usar heurística). Hoje todo anti-pattern é reportado com a mesma autoridade. Com confidence scores, o relatório vira algo que um CTO leva a sério.

**5.1.4. Usar um LLM como "synthesizer" final.** A saída hoje é uma concatenação mecânica de seções. Proposta: depois que todos os workers determinísticos rodarem, um LLM (Claude Haiku ou Sonnet, baratinho) recebe os outputs estruturados e escreve o *executive summary* e o *priority action list* em linguagem natural, com trade-offs explícitos. Isso combina o rigor das heurísticas com a capacidade de síntese do LLM. Custo: alguns centavos por análise. Valor: muito maior do que o texto canned atual.

Importante: o LLM **não substitui** as heurísticas — ele sintetiza o que as heurísticas produziram. A verdade factual continua vindo do código determinístico. O LLM só fala sobre o que o scanner viu.

**5.1.5. Paralelizar o scanner por diretório de topo.** `scanner.ts` hoje é sequencial. Para monorepos, dividir por workspace e processar cada workspace em worker threads (Node `worker_threads`) é ganho grande e direto.

**5.1.6. Substituir regex por AST real.** Todos os detectores que hoje usam regex (`countMethods`, `countInternalExports`, `parseImports`) precisam migrar para:
- `acorn` ou `@typescript-eslint/parser` para TS/JS
- `tree-sitter` com parsers para Python, Go, Rust, Java (tree-sitter já é multi-linguagem)
- Adaptador comum `ASTParser` com interface única

Esse é o único jeito de o scorer ter credibilidade.

### 5.2. Frente B — Architect como criador de agent teams reais

Aqui o objetivo é evoluir o `agent-generator` de gerador de documentação markdown para gerador de **agentes executáveis** — ou seja, um *runtime specification* que pode ser consumido por orquestradores reais (Claude Agent SDK, LangGraph, CrewAI, MCP server, ou um runtime próprio).

**5.2.1. Agent Specification Language.** Definir um schema YAML ou JSON Schema formal para agentes. Cada agente gerado deve declarar:

```yaml
id: backend-developer
version: 1.0
inputs:
  user_story:
    type: string
    required: true
  api_contract:
    type: file
    format: openapi/3.0
    required: false
outputs:
  code:
    type: file
    extension: [.ts, .js]
    constraints:
      max_file_lines: 500
  tests:
    type: file
    extension: [.test.ts]
    constraints:
      min_coverage: 0.8
tools:
  - id: git
    permissions: [read, commit]
  - id: shell
    permissions: [run]
    allowlist: ["npm test", "npm run lint", "tsc --noEmit"]
  - id: filesystem
    permissions: [read, write]
    paths: ["src/**", "tests/**"]
    denylist: [".env", "secrets/**"]
constraints:
  max_tokens_per_run: 50000
  max_tool_calls: 100
  timeout_seconds: 600
escalation:
  - when: "test_coverage < 0.80"
    action: "request_human_review"
  - when: "tool_calls > 80"
    action: "summarize_and_checkpoint"
```

Isso transforma "agente" de conceito abstrato em artefato executável. Qualquer runtime que entenda esse schema pode instanciar e rodar.

**5.2.2. Runtime de referência mínimo.** Escrever um runtime simples, em TypeScript, que consome essas specs e executa agentes via Claude API. Não precisa ser perfeito — precisa ser *existente*. Um arquivo `runtime/executor.ts` que:

- Recebe uma `AgentSpec` e um `task`
- Inicializa contexto, budget, tools
- Faz loop de `claude.messages.create` com tool use
- Aplica guardrails (budget, allowlist, timeout, escalation rules)
- Retorna `AgentResult` estruturado

Isso dá ao architect uma diferença fundamental: ele *roda* o que gera. Hoje ele só escreve markdown e espera que alguém execute em outro lugar.

**5.2.3. Workflows como state machines executáveis.** Hoje workflows são markdown com checkboxes. Proposta: cada workflow vira uma `WorkflowSpec` com nodes (agents) e edges (transitions condicionais).

```yaml
id: new-feature
start: clarify-requirements
nodes:
  clarify-requirements:
    agent: product-analyst
    next: design
  design:
    agent: system-designer
    next:
      - when: "requires_new_api: true"
        goto: api-design
      - default:
        goto: implement
  api-design:
    agent: api-designer
    next: implement
  implement:
    agent: backend-developer
    next: review
  review:
    agent: code-reviewer
    next:
      - when: "score >= 80"
        goto: done
      - when: "score < 80"
        goto: implement
        max_loops: 3
  done:
    terminal: true
```

Isso vira um DAG executável. O mesmo runtime de 5.2.2 pode interpretar workflows, dispatching agents em sequência ou paralelo conforme a spec.

**5.2.4. Tool catalog.** O `agent-generator` hoje não sabe quais ferramentas existem. Proposta: manter um `tool-catalog.yaml` com ferramentas conhecidas (git, npm, pytest, jest, tsc, eslint, docker, kubectl, ...), cada uma com descrição de input/output, permissões requeridas, e adapters para o runtime. Quando o generator produz um agente, ele seleciona ferramentas do catálogo conforme o stack detectado (NestJS → jest + tsc + eslint; Django → pytest + mypy + ruff).

**5.2.5. Approval gates como código.** Substituir `□ Human reviewed` por `GateSpec`:

```yaml
gates:
  pre-merge:
    rules:
      - id: tests-pass
        type: shell
        command: "npm test"
        required: true
      - id: coverage-threshold
        type: metric
        metric: coverage.lines
        operator: ">="
        value: 0.80
      - id: human-approval
        type: human
        role: tech-lead
        required_for: ["production-deploys", "schema-changes"]
```

O runtime avalia o gate, retorna `passed/blocked/pending_human`, e o workflow avança ou pausa. Isso é o que transforma "documentação de processo" em "processo executável".

**5.2.6. Context isolation entre agents.** No runtime, cada agent roda com sua própria janela de contexto. Inputs são passados explicitamente via spec; outputs são resumos estruturados que o orchestrator consome. Isso replica dentro do `architect` o mesmo padrão orchestrator-worker que vai beneficiar a Frente A. O aprendizado é compartilhado.

**5.2.7. Observabilidade nativa.** Cada run de agente emite eventos estruturados (start, tool_call, tool_result, llm_call, budget_update, end). Um `Telemetry` collector grava isso em JSONL localmente e, opcionalmente, exporta para OpenTelemetry. Sem isso, debugar um workflow de agentes é impossível. Com isso, o architect vira observável desde o dia 1 — justamente o oposto da maioria dos projetos multi-agente que tratam observabilidade como afterthought.

### 5.3. Como Frente A e Frente B se encontram

A inversão elegante: o runtime construído na Frente B (5.2.2) pode ser *usado pela própria Frente A*. Ou seja, em vez de implementar o orquestrador interno do architect do zero, o próprio architect pode rodar como um workflow do seu próprio runtime.

```yaml
# architect-self-analysis.workflow.yaml
id: architect-analysis
nodes:
  scan:
    agent: scanner-worker
    parallel: false
  analyze-deps:
    agent: dependency-analyzer
    depends_on: [scan]
  detect-patterns:
    parallel:
      - agent: god-class-detector
      - agent: circular-dep-detector
      - agent: feature-envy-detector
      - agent: leaky-abstraction-detector
    depends_on: [analyze-deps]
  score:
    agent: scorer
    depends_on: [detect-patterns]
  summarize:
    agent: llm-synthesizer
    depends_on: [score]
```

Isso é dogfood radical: o architect usa sua própria infraestrutura de agentes para se analisar. Bugs no runtime aparecem imediatamente. Melhorias no runtime melhoram a análise. Uma única engine evolui nos dois papéis. É exatamente o padrão que companhias de infra boas seguem — você usa seu próprio produto no seu próprio desenvolvimento.

---

## 6. Roadmap priorizado (o que fazer nos próximos 3–6 meses)

Dividi em três ondas. Cada onda tem um tema e um critério de saída.

### Onda 1 — Consertar o que dá vergonha (4–6 semanas)

Objetivo: fazer o produto honesto antes de expandir.

Itens:

1. **Substituir regex por AST** nos detectores de anti-patterns (`countMethods`, `countInternalExports`, `parseImports`). Usar `@typescript-eslint/parser` para TS/JS. Manter regex como fallback só para linguagens ainda não cobertas e marcar confidence=low nesses casos.
2. **Honrar `.gitignore` real** no scanner. Combinar com `config.ignore`. Dependência: `ignore` do npm.
3. **Detectar binários** no scanner antes de ler como UTF-8.
4. **Substituir CLI parsing manual** por `commander` ou `citty`. Validar paths, formato, criar dirs de output.
5. **Adicionar try/catch em volta de `emit()`** no orquestrador. Adicionar `AbortSignal` no caminho crítico.
6. **Cachear o resultado de `analyzer.analyzeDependencies()`** dentro de `analyze()`. Evitar as chamadas duplicadas. Cachear `analyze()` para que `score()`, `antiPatterns()`, `layers()` não reexecutem o pipeline inteiro.
7. **Escapar HTML consistentemente** no `html-reporter.ts`. Audit de XSS e fix completo. Adicionar um teste unitário simples que injeta payloads conhecidos e verifica que são escapados.
8. **Recalibrar ou remover o score numérico.** Opção A (rápida): trocar "72/100" por categorias ("Sólido / Atenção / Crítico") por dimensão. Opção B (certa): coletar um dataset de 50+ projetos open-source conhecidos e calibrar os breakpoints contra métricas externas (bug tracker velocity, contributor count, age).
9. **Eliminar stack-detector duplicado** no agent-generator. Consolidar no framework-detector.

Critério de saída: rodar `architect analyze` no próprio repositório do architect e ter um relatório que você não tem vergonha de mostrar para outro CTO.

### Onda 2 — Refactor de core para multi-agente interno (6–10 semanas)

Objetivo: destravar a arquitetura para a Frente A.

Itens:

1. **Introduzir `AnalysisPhase` e `AnalysisOrchestrator`.** Migrar as 7 fases de `analyze()` para phases explícitas. Construir DAG de dependências. Rodar em batches topológicos com paralelismo dentro de cada batch.
2. **`AnalysisContext` imutável com cache por hash.** Hash de conteúdo por arquivo, cache em memória (e opcionalmente em disco para CLI rodando contra o mesmo repo repetidas vezes).
3. **Quebrar detectores de anti-patterns em workers plugáveis.** Cada detector declara input/output e confidence. Rodar todos em paralelo.
4. **Paralelizar scanner por workspace de topo** em monorepos. Usar `worker_threads`.
5. **Adicionar LLM synthesizer opcional.** Flag `--summary=llm` chama Claude para escrever o executive summary baseado nos outputs estruturados. Off por padrão (custo); on quando o usuário quer.
6. **Extrair runtime básico de agentes** (`runtime/executor.ts`) em módulo separado. Começar simples: recebe uma `AgentSpec` mínima, roda um único agente, aplica budget e timeout. Sem workflows ainda.
7. **Testes de integração end-to-end** em pelo menos 5 projetos representativos: um NestJS, um Django, um Go, um React SPA, um monorepo. Garantir que o architect roda sem erro e os resultados são razoáveis em todos.

Critério de saída: a análise roda 2–3x mais rápido em projetos médios, o código é modular o suficiente para que um colaborador novo adicione uma fase sem entender o core inteiro, e existe um runtime mínimo rodando um agente de ponta a ponta.

### Onda 3 — Runtime de agentes de verdade (10–16 semanas)

Objetivo: Frente B completa.

Itens:

1. **`AgentSpec` e `WorkflowSpec` com schema formal** (JSON Schema + validação). Documentação do schema. Migration path: o agent-generator começa a emitir specs além do markdown.
2. **Runtime executando workflows completos**, com state machine, tool use, approval gates, escalation, observabilidade.
3. **Tool catalog** com 20+ ferramentas comuns mapeadas, com adapters para o runtime.
4. **Agent-generator v2** gerando specs executáveis *e* markdown legível para humanos (dois artefatos do mesmo pipeline).
5. **Architect se rodando como workflow** do próprio runtime (dogfood completo).
6. **MCP server opcional** expondo o architect como tool para outros agentes consumirem. Isso transforma o architect de CLI em infra.
7. **Telemetria via OpenTelemetry**, com traces de workflows completos exportáveis para Grafana/Honeycomb.

Critério de saída: um time externo consegue pegar o architect, rodar em seu repo, e ter um pipeline de agentes executando reviews automáticos de PR, ou gerando ADRs, ou mantendo documentação, em produção.

---

## 7. Considerações finais (do amigo, não do reviewer)

O `architect` é melhor do que a crítica acima sugere em isolamento. A crítica é forte porque o projeto *pode* ser muito mais do que é. Projetos medianos eu não criticaria nesse nível de detalhe — não vale o tempo. Este vale.

O que o diferencia dos 90% dos side-projects de CTO no GitHub:

- Disciplina de stack (2 deps de runtime, strict TS).
- Estrutura de módulos com SRP real.
- Onda recente de testes mostrando que o autor está subindo a barra.
- Uma ambição coerente (análise + governança de IA no mesmo lugar).
- Git hygiene que permite colaboração.

O que te separa de ser um produto sério:

- Honestidade nas métricas (score, anti-patterns).
- AST em vez de regex.
- Saída do modelo "gerador de docs" para "runtime executável".
- Observabilidade.
- Dogfood.

O caminho da Onda 1 é essencialmente recuperação de débito técnico. A Onda 2 é onde o projeto muda de categoria (de CLI batch para analisador modular). A Onda 3 é onde ele vira infraestrutura — e é nesse ponto que vira produto defensável, porque "ferramenta que analisa arquitetura" tem cem concorrentes, mas "runtime de agentes integrado a análise arquitetural com governança pronta por stack" é território vazio.

Um alerta de priorização: não pule a Onda 1 para ir direto à 3. A tentação vai ser grande (runtime de agentes é mais divertido do que consertar regex). Mas um produto com runtime elegante em cima de detectores que mentem é um castelo de cartas. Primeiro a base, depois o andar novo.

E um elogio genuíno: o fato de você ter pedido essa análise "sem dó" é o que separa CTOs que crescem dos que estagnam. A maioria dos donos de produto pede feedback e filtra o que ouve. Você está fazendo o oposto. É isso que vai fazer o architect virar algo sério — não porque ele é bom hoje, mas porque você está disposto a ver o que ele não é e arrumar.
