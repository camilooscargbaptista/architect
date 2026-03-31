import path from 'path';
import { ASTParser } from './ast-parser.interface.js';
import Parser, { Query } from 'tree-sitter';

export class TreeSitterParser implements ASTParser {
  private parsers: Map<string, Parser> = new Map();
  private queries: Map<string, Query> = new Map();

  async initialize(): Promise<void> {
    try {
      // Dynamic ESM imports to handle native bindings gracefully
      const tsMod = await import('tree-sitter-typescript').catch(() => null);
      const jsMod = await import('tree-sitter-javascript').catch(() => null);
      const pyMod = await import('tree-sitter-python').catch(() => null);
      const goMod = await import('tree-sitter-go').catch(() => null);
      const javaMod = await import('tree-sitter-java').catch(() => null);
      const rustMod = await import('tree-sitter-rust').catch(() => null);

      if (tsMod) {
        // Handle CJS vs ESM interop structures
        const tsLang = tsMod.default?.typescript || tsMod.typescript || tsMod;
        const tsxLang = tsMod.default?.tsx || tsMod.tsx;
        this.initParser('.ts', tsLang);
        this.initParser('.tsx', tsxLang);
      }

      if (jsMod) {
        const jsLang = jsMod.default || jsMod;
        this.initParser('.js', jsLang);
        this.initParser('.jsx', jsLang);
      }

      if (pyMod) {
        this.initParser('.py', pyMod.default || pyMod);
      }

      if (goMod) {
        this.initParser('.go', goMod.default || goMod);
      }

      if (javaMod) {
        this.initParser('.java', javaMod.default || javaMod);
      }

      if (rustMod) {
        this.initParser('.rs', rustMod.default || rustMod);
      }

      if (this.parsers.size === 0) {
        throw new Error('No Tree-Sitter grammars were successfully loaded.');
      }
    } catch (err) {
      throw new Error(`AST Parsers failed to initialize: ${(err as Error).message}`);
    }
  }

  private initParser(ext: string, languageOption: any): void {
    if (!languageOption) return;
    try {
      const parser = new Parser();
      parser.setLanguage(languageOption);
      this.parsers.set(ext, parser);

      // Pre-compile queries for performance based on language
      let queryStr = '';
      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        // Matches "import X from 'path'", "import('path')", "require('path')", "export * from 'path'"
        queryStr = `
          (import_statement source: (string) @path)
          (export_statement source: (string) @path)
          (call_expression
            function: [(identifier) (import)] @fn
            arguments: (arguments (string) @path)
            (#match? @fn "^(require|import)$")
          )
        `;
      } else if (ext === '.py') {
        // python imports
        queryStr = `
          (import_from_statement module_name: (_) @module)
          (import_statement name: (_) @module)
        `;
      } else if (ext === '.go') {
        queryStr = `
          (import_spec path: (interpreted_string_literal) @path)
        `;
      } else if (ext === '.java') {
        queryStr = `
          (import_declaration (scoped_identifier) @path)
        `;
      } else if (ext === '.rs') {
        queryStr = `
          (use_declaration argument: (scoped_identifier) @path)
        `;
      }

      if (queryStr) {
        const query = new Query(languageOption, queryStr);
        this.queries.set(ext, query);
      }
    } catch (e) {
      console.error(`[TreeSitter] Query compilation failed for ${ext}:`, e);
      // Ignore parser failure for a specific extension silently, letting fallback take over
    }
  }

  parseImports(content: string, filePath: string): string[] {
    const ext = path.extname(filePath);
    const parser = this.parsers.get(ext);
    const query = this.queries.get(ext);

    if (!parser || !query) {
      throw new Error(`Tree-Sitter parser not mapped/loaded for extension ${ext}`);
    }

    const tree = parser.parse(content);
    const matches = query.matches(tree.rootNode);
    
    const imports: string[] = [];

    for (const match of matches) {
      // Extract the captured module paths/names
      for (const capture of match.captures) {
        if (capture.name === 'path' || capture.name === 'module') {
          // Remove quotes around literal strings (e.g., "'./module'" -> "./module")
          let value = capture.node.text.replace(/['"]/g, '');
          
          if (ext === '.py') {
            value = value.split(' as ')[0].trim();
          }
          
          imports.push(value);
        }
      }
    }

    // Anti-GC trick for V8 + node-tree-sitter: 
    // If the 'tree' object is not referenced after 'query.matches()', V8's aggressive GC
    // might destroy the Tree before 'query.matches' fully executes its C++ bindings,
    // resulting in "Cannot read properties of undefined (reading 'tree')" inside marshalNode.
    // Calling tree.delete() explicitly fixes memory leaks AND keeps the reference alive.
    if (typeof (tree as any).delete === 'function') {
      (tree as any).delete();
    }

    return imports;
  }
}
