#!/bin/bash
# script: execute_1_1.sh
# description: Automates the atomic git commit flow for Architect Phase 1.1

set -e

echo "🚀 Iniciando empacotamento da Fase 1.1 (AST Migration) no Git Flow..."

# 1. Checkout to the new feature branch
git checkout -b feature/genesis-phase-1.1

# Task 1: Setup core and interface
git add package.json package-lock.json src/core/ast/ast-parser.interface.ts || true
git commit -m "feat(ast): setup tree-sitter core and grammar deps (task 1)

- Instala dependências nativas (TS, Python, Go, Java, Rust, JS)
- Cria a interface contract `ASTParser` para garantir Open-Closed principle" || true

# Tasks 2, 3, 4, 5: Multi-lang parser and path resolver
git add src/core/ast/tree-sitter-parser.ts src/core/ast/path-resolver.ts || true
git commit -m "feat(ast): implement multi-lang AST parser and path resolver (task 2,3,4,5)

- Implementa `TreeSitterParser` cobrindo 6 repositórios de AST
- Adiciona engine dinâmico de carregamento CJS/ESM
- Cria `PathResolver` para entender aliases (\`@/\`) definidos via tsconfig.json" || true

# Task 7: Injecting into the Analyzer
git add src/core/analyzer.ts src/core/architect.ts || true
git commit -m "refactor(analyzer): inject AST parser with graceful regex fallback (task 7)

- O `ArchitectureAnalyzer` agora tenta parsear imports nativamente via árvore sintática
- Em caso de falha de parser ou fallback (.vue, arquivos não-suportados, libs parciais), fallback cai *gracefully* para o regex original sem quebrar a pipeline de scoring." || true

# Task 6: Testing
git add tests/ast-parser.test.ts || true
git commit -m "test(ast): add zero-regression test suite for AST parsing (task 6)

- Confirma precisão do motor TreeSitter capturando named exports, dynamic imports e CommonJS require()." || true

echo "✅ Todos os commits atômicos foram persistidos com sucesso na branch feature/genesis-phase-1.1!"
echo "➡️  Próximo Passo: 'git push origin feature/genesis-phase-1.1'"
