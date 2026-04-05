/**
 * Standard Library Registry — Multi-language external dependency detection.
 *
 * Prevents the Genesis Engine from treating stdlib/vendor imports as
 * internal project modules. Covers all 6 languages supported by
 * the Tree-sitter parser: TypeScript, JavaScript, Python, Go, Rust, Java.
 *
 * @since v8.2.0
 * @see EVOLUTION_PLAN.md Fix 0.1
 */

// ── Node.js Built-ins ────────────────────────────────────────────────

const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
  'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
  'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl',
  'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
  // Subpath exports (Node 16+)
  'fs/promises', 'stream/promises', 'stream/web', 'timers/promises',
  'util/types', 'dns/promises', 'readline/promises',
]);

// ── Python Standard Library (3.10+) ─────────────────────────────────

const PYTHON_STDLIB = new Set([
  'os', 'sys', 'io', 'json', 'csv', 'math', 'random', 'datetime',
  'collections', 'itertools', 'functools', 'typing', 'pathlib',
  'subprocess', 'threading', 'multiprocessing', 'socket', 'http',
  'urllib', 'email', 'logging', 'argparse', 'unittest', 'abc',
  'dataclasses', 'enum', 're', 'hashlib', 'hmac', 'secrets',
  'asyncio', 'concurrent', 'contextlib', 'copy', 'pprint',
  'textwrap', 'struct', 'codecs', 'glob', 'shutil', 'tempfile',
  'sqlite3', 'xml', 'html', 'importlib', 'inspect', 'traceback',
  'string', 'decimal', 'fractions', 'statistics', 'array',
  'heapq', 'bisect', 'queue', 'types', 'weakref', 'pickle',
  'shelve', 'dbm', 'gzip', 'bz2', 'lzma', 'zipfile', 'tarfile',
  'configparser', 'tomllib', 'netrc', 'pdb', 'cProfile', 'profile',
  'time', 'sched', 'signal', 'mmap', 'ctypes', 'select', 'selectors',
  'ssl', 'ftplib', 'smtplib', 'imaplib', 'poplib', 'xmlrpc',
  'ipaddress', 'uuid', 'base64', 'binascii', 'quopri', 'uu',
  'warnings', 'atexit', 'builtins', 'platform', 'locale',
]);

// ── Rust Standard Library Crates ─────────────────────────────────────

const RUST_STDLIB = new Set([
  'std', 'core', 'alloc', 'proc_macro', 'test',
]);

// ── Java Standard Library Prefixes ───────────────────────────────────

const JAVA_STDLIB_PREFIXES = [
  'java.', 'javax.', 'sun.', 'com.sun.', 'jdk.',
  'org.w3c.', 'org.xml.', 'org.ietf.',
];

// ── Go Standard Library ──────────────────────────────────────────────
// Go stdlib packages do NOT contain dots in their import path.
// Third-party packages always have a domain: "github.com/...", "golang.org/x/..."

// ── Types ────────────────────────────────────────────────────────────

export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java';

// ── Core API ─────────────────────────────────────────────────────────

/**
 * Determines whether a given import path refers to an external dependency
 * (standard library, vendor package, npm module, etc.) rather than a
 * project-internal source file.
 *
 * The check is language-aware and covers:
 * - Node.js builtins (fs, path, crypto, node:fs, etc.)
 * - Python stdlib (os, sys, json, etc.)
 * - Go stdlib (no dots = stdlib)
 * - Rust stdlib (std, core, alloc, proc_macro)
 * - Java stdlib (java.*, javax.*, etc.)
 * - npm bare specifiers (lodash, @org/pkg) not in projectFiles
 *
 * @param importPath - The raw import specifier from source code
 * @param language - The detected project language
 * @param projectFiles - Set of known project file paths (from dependencyGraph.nodes)
 * @returns true if the import is external (should be filtered from analysis)
 */
export function isExternalDependency(
  importPath: string,
  language: SupportedLanguage,
  projectFiles: Set<string>,
): boolean {
  // ── Universal: relative paths are ALWAYS internal ──
  if (
    importPath.startsWith('./') ||
    importPath.startsWith('../') ||
    importPath.startsWith('/')
  ) {
    return false;
  }

  // ── Language-specific stdlib checks ──
  switch (language) {
    case 'typescript':
    case 'javascript': {
      // node: protocol prefix (Node 16+)
      if (importPath.startsWith('node:')) return true;

      // Known builtins (exact match or base module match)
      const baseModule = importPath.split('/')[0]!;
      if (NODE_BUILTINS.has(importPath) || NODE_BUILTINS.has(baseModule)) {
        return true;
      }

      // Scoped packages (@org/pkg) — always external
      if (importPath.startsWith('@') && importPath.includes('/')) {
        const scopedBase = importPath.split('/').slice(0, 2).join('/');
        if (!projectFiles.has(scopedBase) && !projectFiles.has(importPath)) {
          return true;
        }
      }

      // Bare specifier without relative prefix — likely npm package
      if (!importPath.startsWith('.') && !projectFiles.has(importPath)) {
        // Extra heuristic: no file extension = almost certainly a package
        if (!importPath.includes('.') || importPath.startsWith('node_modules')) {
          return true;
        }
      }
      break;
    }

    case 'python': {
      const topModule = importPath.split('.')[0]!;
      if (PYTHON_STDLIB.has(topModule)) return true;
      break;
    }

    case 'go': {
      // Go stdlib has no dots in import path. Third-party always has domain.
      if (!importPath.includes('.')) return true;
      break;
    }

    case 'rust': {
      const rootCrate = importPath.split('::')[0]!;
      if (RUST_STDLIB.has(rootCrate)) return true;
      break;
    }

    case 'java': {
      if (JAVA_STDLIB_PREFIXES.some(prefix => importPath.startsWith(prefix))) {
        return true;
      }
      break;
    }
  }

  return false;
}

/**
 * Detects the SupportedLanguage from ProjectInfo.primaryLanguages.
 * Falls back to 'typescript' if unrecognized.
 */
export function detectLanguage(
  projectInfo: { primaryLanguages?: string[] },
): SupportedLanguage {
  const lang = (projectInfo.primaryLanguages?.[0] || '').toLowerCase();

  const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
    typescript: 'typescript',
    ts: 'typescript',
    javascript: 'javascript',
    js: 'javascript',
    python: 'python',
    py: 'python',
    go: 'go',
    golang: 'go',
    rust: 'rust',
    rs: 'rust',
    java: 'java',
  };

  return LANGUAGE_MAP[lang] ?? 'typescript';
}
