Eu criei uma ferramenta que analisa a arquitetura do seu código e te diz exatamente onde ele vai quebrar.

Não é linter. Não é SonarQube. Não é code review.

É um raio-X completo da saúde estrutural do seu software.

Chama Architect Intelligence, e hoje ela está disponível de graça no VS Code, Cursor e Antigravity.

Deixa eu explicar o que ela faz:

Você abre seu projeto. Ela parseia o AST de cada arquivo, monta o grafo de dependências completo, detecta anti-patterns (God Class, Shotgun Surgery, Hub Files), calcula um score de 0 a 100 e te mostra inline no editor — como se fosse um ESLint, mas para arquitetura.

Só que vai além.

Ela usa regressão linear com peso temporal nos seus commits do Git pra PREVER quando seu score vai cair abaixo do aceitável. Tipo um forecast de degradação arquitetural. Os arquivos que estão em risco ficam com background vermelho no editor antes de virarem problema.

E quando encontra um problema? Ela não só detecta — ela gera um plano de refactoring com steps priorizados, preview das mudanças, e prompts prontos pra você colar no Claude/GPT e executar a refatoração.

Right-click em qualquer arquivo → "Generate Refactoring Prompt" → pronto.

Números do projeto:

→ 16 fases de evolução, de bug fixes até ML-based prediction
→ 730+ testes automatizados
→ 6 linguagens suportadas (TS, JS, Python, Go, Rust, Java)
→ 5 regras de refactoring plugáveis + sistema de plugins pra criar as suas
→ Score breakdown em 4 dimensões: modularidade, acoplamento, coesão, layering
→ Forecast com intervalo de confiança de 95% e detecção de threshold crítico
→ Zero dependências externas na extensão — 18KB no total

O que aparece no seu editor:

◉ Hub File — 12 dependents (Code Lens no topo do arquivo)
⚠ Critical Risk — score dropping (overlay visual em arquivos at-risk)
💡 Refactoring suggestions inline no painel de Problems

Tudo isso rodando local. Sem API. Sem telemetria. Sem subscription.

Eu construí isso porque cansei de ver projetos morrerem não por bugs, mas por arquitetura que ninguém cuidou até ser tarde demais.

Score alto no início do projeto é fácil. Manter ele alto com 50 desenvolvedores commitando por 2 anos é o verdadeiro desafio.

Architect Intelligence é a ferramenta que eu queria ter tido nos últimos 10 anos como CTO.

Agora ela existe. E é open source.

Pesquisa "Architect Intelligence" no marketplace da sua IDE e testa agora.

Se isso te ajudou a pensar diferente sobre qualidade de código, compartilha com aquele dev que vive dizendo "depois a gente refatora".

A gente sabe que "depois" nunca chega.

#SoftwareArchitecture #DevTools #OpenSource #VSCode #Cursor #CodeQuality #Refactoring #TypeScript #DeveloperExperience
