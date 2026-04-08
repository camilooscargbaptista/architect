/**
 * Language Utilities — Multi-language support for code generation.
 *
 * Provides language-aware file extensions, comment syntax, and barrel
 * file detection for all 6 Tree-sitter supported languages.
 *
 * @since v8.2.0
 * @see EVOLUTION_PLAN.md Fix 0.2
 */

import type { SupportedLanguage } from './stdlib-registry.js';

// ── Extension Map ────────────────────────────────────────────────────

const EXTENSION_MAP: Record<SupportedLanguage, string> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  go: 'go',
  rust: 'rs',
  java: 'java',
};

// ── Comment Syntax ───────────────────────────────────────────────────

export interface CommentSyntax {
  line: string;
  blockStart: string;
  blockEnd: string;
}

const COMMENT_SYNTAX: Record<SupportedLanguage, CommentSyntax> = {
  typescript:  { line: '//',  blockStart: '/**', blockEnd: ' */' },
  javascript:  { line: '//',  blockStart: '/**', blockEnd: ' */' },
  python:      { line: '#',   blockStart: '"""', blockEnd: '"""' },
  go:          { line: '//',  blockStart: '/*',  blockEnd: '*/' },
  rust:        { line: '//',  blockStart: '/*',  blockEnd: '*/' },
  java:        { line: '//',  blockStart: '/**', blockEnd: ' */' },
};

// ── Barrel File Names ────────────────────────────────────────────────

const BARREL_FILENAMES: Record<SupportedLanguage, Set<string>> = {
  typescript:  new Set(['index.ts', 'index.tsx', 'mod.ts']),
  javascript:  new Set(['index.js', 'index.mjs', 'index.cjs', 'index.jsx']),
  python:      new Set(['__init__.py']),
  go:          new Set([]), // Go doesn't use barrel files
  rust:        new Set(['mod.rs', 'lib.rs']),
  java:        new Set(['package-info.java']),
};

// ── Module Initialization Templates ──────────────────────────────────

const MODULE_INIT_TEMPLATES: Record<SupportedLanguage, (moduleName: string) => string> = {
  typescript: (name) => `// ${name} — module barrel\n\nexport {};\n`,
  javascript: (name) => `// ${name} — module barrel\n\nmodule.exports = {};\n`,
  python:     (name) => `"""${name} — module package."""\n`,
  go:         (name) => `package ${name.toLowerCase().replace(/[^a-z0-9]/g, '')}\n`,
  rust:       (name) => `//! ${name} — module definition\n`,
  java:       (name) => `// ${name} — package\n`,
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Returns the standard file extension for a given language.
 * Falls back to 'txt' for unknown languages.
 */
export function getExtension(language: SupportedLanguage): string {
  return EXTENSION_MAP[language] ?? 'txt';
}

/**
 * Returns the comment syntax for a given language.
 */
export function getCommentSyntax(language: SupportedLanguage): CommentSyntax {
  return COMMENT_SYNTAX[language] ?? COMMENT_SYNTAX.typescript;
}

/**
 * Returns the set of barrel file names for a given language.
 */
export function getBarrelFilenames(language: SupportedLanguage): Set<string> {
  return BARREL_FILENAMES[language] ?? BARREL_FILENAMES.typescript;
}

/**
 * Returns the default barrel/init file name for a module in the given language.
 */
export function getModuleInitFilename(language: SupportedLanguage): string {
  const names = BARREL_FILENAMES[language];
  if (names && names.size > 0) {
    return [...names][0]!; // First entry is the canonical one
  }
  return `index.${getExtension(language)}`;
}

/**
 * Returns a template for a new module init/barrel file.
 */
export function getModuleInitContent(
  language: SupportedLanguage,
  moduleName: string,
): string {
  const template = MODULE_INIT_TEMPLATES[language] ?? MODULE_INIT_TEMPLATES.typescript;
  return template(moduleName);
}

/**
 * Generates language-appropriate code content for a new split file.
 * Used by HubSplitter and ModuleGrouper when creating new modules.
 */
export function generateSplitFileContent(
  language: SupportedLanguage,
  moduleName: string,
  groupName: string,
  dependents: string[],
): string {
  const comment = getCommentSyntax(language);
  const usedBy = dependents.join(', ');

  switch (language) {
    case 'python':
      return `"""${moduleName}_${groupName} — extracted from ${moduleName}."""\n# Used by: ${usedBy}\n`;
    case 'go':
      return `package ${groupName.toLowerCase().replace(/[^a-z0-9]/g, '')}\n\n${comment.line} ${moduleName}_${groupName} — extracted from ${moduleName}\n${comment.line} Used by: ${usedBy}\n`;
    case 'rust':
      return `//! ${moduleName}_${groupName} — extracted from ${moduleName}\n//! Used by: ${usedBy}\n`;
    case 'java':
      return `/**\n * ${moduleName}_${groupName} — extracted from ${moduleName}.\n * Used by: ${usedBy}\n */\n`;
    default:
      // TypeScript / JavaScript
      return `// ${moduleName}_${groupName} — extracted from ${moduleName}\n// Used by: ${usedBy}\n`;
  }
}

/**
 * Generates language-appropriate facade/dependency aggregation content.
 * Used by ImportOrganizer when creating dependency facades.
 */
export function generateFacadeContent(
  language: SupportedLanguage,
  targets: string[],
  dirs: string[],
): string {
  const comment = getCommentSyntax(language);

  switch (language) {
    case 'python': {
      const imports = targets
        .map(t => `# from ${t.replace(/\//g, '.')} import ...`)
        .join('\n');
      return `"""Dependency facade — centralizes cross-module imports."""\n\n${imports}\n\n# Re-export what ${dirs.length} modules need\n`;
    }
    case 'go': {
      const imports = targets
        .map(t => `// import "${t}"`)
        .join('\n');
      return `package facade\n\n${imports}\n\n// Centralize ${dirs.length} cross-package dependencies\n`;
    }
    case 'rust': {
      const imports = targets
        .map(t => `// use ${t.replace(/\//g, '::')};`)
        .join('\n');
      return `//! Dependency facade — centralizes cross-module imports.\n\n${imports}\n`;
    }
    case 'java': {
      const imports = targets
        .map(t => `// import ${t.replace(/\//g, '.')};`)
        .join('\n');
      return `/**\n * Dependency facade — centralizes cross-module imports.\n */\n\n${imports}\n`;
    }
    default: {
      // TypeScript / JavaScript
      const imports = targets
        .map(t => `// export { ... } from '${t}';`)
        .join('\n');
      return `${comment.blockStart}\n * Dependency facade — centralizes cross-module imports.\n${comment.blockEnd}\n\n${imports}\n`;
    }
  }
}
