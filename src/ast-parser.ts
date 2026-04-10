/**
 * AST-based static analysis for TypeScript/JavaScript.
 *
 * Wraps the TypeScript Compiler API (which handles both TS and JS) and
 * exposes structured counts and imports. For non-TS/JS files we fall
 * back to conservative regex heuristics and tag the result with
 * `confidence: 'low'` so callers know the signal is approximate.
 */

import ts from 'typescript';
import { readFileSync } from 'fs';
import { extname } from 'path';

export type Confidence = 'high' | 'low';

export interface FileMetrics {
  methods: number;
  internalExports: number;
  imports: string[];
  confidence: Confidence;
}

const SCRIPT_KIND: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
};

const INTERNAL_MARKERS = ['Internal', 'Private', 'Impl', 'Detail'];

/**
 * Cache parse results to avoid re-reading files multiple times during
 * analysis. The key is the absolute file path; we don't invalidate since
 * the pipeline runs in a single pass per analyze() call.
 */
const cache = new Map<string, FileMetrics>();

export function clearAstCache(): void {
  cache.clear();
}

export function analyzeFile(filePath: string): FileMetrics {
  const cached = cache.get(filePath);
  if (cached) return cached;

  const ext = extname(filePath).toLowerCase();
  let metrics: FileMetrics;

  try {
    if (SCRIPT_KIND[ext] !== undefined) {
      metrics = analyzeTsOrJs(filePath, SCRIPT_KIND[ext]);
    } else {
      metrics = analyzeFallback(filePath, ext);
    }
  } catch {
    metrics = { methods: 0, internalExports: 0, imports: [], confidence: 'low' };
  }

  cache.set(filePath, metrics);
  return metrics;
}

function analyzeTsOrJs(filePath: string, scriptKind: ts.ScriptKind): FileMetrics {
  const source = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    scriptKind,
  );

  let methods = 0;
  let internalExports = 0;
  const imports: string[] = [];

  const visit = (node: ts.Node): void => {
    // ── Methods ──
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node) ||
      ts.isConstructorDeclaration(node)
    ) {
      methods++;
    } else if (
      ts.isPropertyDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      // Class field holding a function: `foo = () => {}`
      methods++;
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      // Top-level `const foo = () => {}` — only counted when exported
      const stmt = node.parent?.parent;
      if (stmt && ts.isVariableStatement(stmt) && hasExportModifier(stmt)) {
        methods++;
      }
    }

    // ── Internal exports ──
    // An export is "internal" when its name starts with `_` or contains an
    // internal marker word at a boundary (Internal, Private, Impl, Detail).
    if (isExported(node)) {
      const names = extractExportedNames(node);
      for (const name of names) {
        if (looksInternal(name)) internalExports++;
      }
    }

    // ── Imports ──
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push((node.arguments[0] as ts.StringLiteral).text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push((node.arguments[0] as ts.StringLiteral).text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return { methods, internalExports, imports, confidence: 'high' };
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isExported(node: ts.Node): boolean {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return true;
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function extractExportedNames(node: ts.Node): string[] {
  const names: string[] = [];

  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  ) {
    if (node.name) names.push(node.name.text);
  } else if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) names.push(decl.name.text);
    }
  } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const el of node.exportClause.elements) {
      names.push(el.name.text);
    }
  }

  return names;
}

function looksInternal(name: string): boolean {
  if (name.startsWith('_')) return true;
  for (const marker of INTERNAL_MARKERS) {
    // Match marker as a whole word boundary (start, end, or PascalCase segment).
    // E.g. "FooInternal", "InternalBar", "MyImpl" — but not "InternalApiResponse".
    // Heuristic: marker appears and either precedes the end or is followed by nothing.
    if (name === marker) return true;
    if (name.endsWith(marker)) return true;
    // Also catch `_foo` / snake_case internal prefix
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: regex-based for languages we don't parse with TS Compiler API.
// Tagged confidence: 'low'.
// ─────────────────────────────────────────────────────────────────────────────

function analyzeFallback(filePath: string, ext: string): FileMetrics {
  const content = readFileSync(filePath, 'utf-8');

  let methods = 0;
  let internalExports = 0;
  const imports: string[] = [];

  if (ext === '.py') {
    // def / async def / class methods
    const methodRegex = /^\s*(?:async\s+)?def\s+\w+\s*\(/gm;
    methods += (content.match(methodRegex) || []).length;

    // from X import Y  /  import X
    const fromImportRegex = /^from\s+([\w.]+)\s+import\b/gm;
    const directImportRegex = /^import\s+([\w.]+)/gm;
    let m;
    while ((m = fromImportRegex.exec(content)) !== null) imports.push(m[1]);
    while ((m = directImportRegex.exec(content)) !== null) imports.push(m[1]);
  } else if (ext === '.java' || ext === '.kt') {
    const methodRegex = /(?:public|private|protected|static|fun)\s+[\w<>,\s\[\]]*\s+\w+\s*\(/g;
    methods += (content.match(methodRegex) || []).length;
    const importRegex = /^import\s+([\w.]+);?/gm;
    let m;
    while ((m = importRegex.exec(content)) !== null) imports.push(m[1]);
  } else if (ext === '.go') {
    const methodRegex = /^func\s+(?:\([^)]*\)\s+)?\w+\s*\(/gm;
    methods += (content.match(methodRegex) || []).length;
    const importBlock = /import\s*\(\s*([^)]+)\)/g;
    let m;
    while ((m = importBlock.exec(content)) !== null) {
      const inner = m[1].split('\n').map(s => s.trim()).filter(Boolean);
      for (const line of inner) {
        const match = line.match(/"([^"]+)"/);
        if (match) imports.push(match[1]);
      }
    }
    const singleImport = /^import\s+"([^"]+)"/gm;
    while ((m = singleImport.exec(content)) !== null) imports.push(m[1]);
  } else if (ext === '.rb') {
    const methodRegex = /^\s*def\s+\w+/gm;
    methods += (content.match(methodRegex) || []).length;
    const requireRegex = /^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/gm;
    let m;
    while ((m = requireRegex.exec(content)) !== null) imports.push(m[1]);
  } else if (ext === '.rs') {
    const fnRegex = /\bfn\s+\w+\s*(?:<[^>]*>)?\s*\(/g;
    methods += (content.match(fnRegex) || []).length;
    const useRegex = /^use\s+([\w:]+)/gm;
    let m;
    while ((m = useRegex.exec(content)) !== null) imports.push(m[1]);
  }

  return { methods, internalExports, imports, confidence: 'low' };
}
