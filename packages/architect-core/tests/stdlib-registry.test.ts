import { isExternalDependency, detectLanguage } from '../src/core/utils/stdlib-registry.js';
import type { SupportedLanguage } from '../src/core/utils/stdlib-registry.js';

describe('StandardLibraryRegistry', () => {
  const emptyProjectFiles = new Set<string>();

  // ── detectLanguage ──

  describe('detectLanguage', () => {
    it('should detect typescript from primaryLanguages', () => {
      expect(detectLanguage({ primaryLanguages: ['typescript'] })).toBe('typescript');
    });

    it('should detect python from primaryLanguages', () => {
      expect(detectLanguage({ primaryLanguages: ['python'] })).toBe('python');
    });

    it('should detect go from primaryLanguages', () => {
      expect(detectLanguage({ primaryLanguages: ['go'] })).toBe('go');
    });

    it('should handle short aliases (ts, py, rs)', () => {
      expect(detectLanguage({ primaryLanguages: ['ts'] })).toBe('typescript');
      expect(detectLanguage({ primaryLanguages: ['py'] })).toBe('python');
      expect(detectLanguage({ primaryLanguages: ['rs'] })).toBe('rust');
    });

    it('should default to typescript for unknown language', () => {
      expect(detectLanguage({ primaryLanguages: ['cobol'] })).toBe('typescript');
    });

    it('should default to typescript when primaryLanguages is empty', () => {
      expect(detectLanguage({ primaryLanguages: [] })).toBe('typescript');
    });

    it('should default to typescript when primaryLanguages is undefined', () => {
      expect(detectLanguage({})).toBe('typescript');
    });
  });

  // ── isExternalDependency — Universal Rules ──

  describe('isExternalDependency — universal', () => {
    it('should always treat relative paths as internal', () => {
      const langs: SupportedLanguage[] = ['typescript', 'python', 'go', 'rust', 'java'];
      for (const lang of langs) {
        expect(isExternalDependency('./utils', lang, emptyProjectFiles)).toBe(false);
        expect(isExternalDependency('../shared', lang, emptyProjectFiles)).toBe(false);
        expect(isExternalDependency('./foo/bar', lang, emptyProjectFiles)).toBe(false);
      }
    });

    it('should treat absolute paths as internal', () => {
      expect(isExternalDependency('/src/utils', 'typescript', emptyProjectFiles)).toBe(false);
    });
  });

  // ── isExternalDependency — TypeScript/JavaScript ──

  describe('isExternalDependency — typescript/javascript', () => {
    const lang: SupportedLanguage = 'typescript';

    it('should filter Node.js builtins', () => {
      expect(isExternalDependency('fs', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('path', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('crypto', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('http', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('child_process', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('events', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('os', lang, emptyProjectFiles)).toBe(true);
    });

    it('should filter node: protocol imports', () => {
      expect(isExternalDependency('node:fs', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('node:path', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('node:test', lang, emptyProjectFiles)).toBe(true);
    });

    it('should filter Node.js subpath imports', () => {
      expect(isExternalDependency('fs/promises', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('stream/promises', lang, emptyProjectFiles)).toBe(true);
    });

    it('should filter bare npm packages', () => {
      expect(isExternalDependency('lodash', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('express', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('zod', lang, emptyProjectFiles)).toBe(true);
    });

    it('should filter scoped npm packages', () => {
      expect(isExternalDependency('@nestjs/core', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('@prisma/client', lang, emptyProjectFiles)).toBe(true);
    });

    it('should NOT filter relative paths', () => {
      expect(isExternalDependency('./utils', lang, emptyProjectFiles)).toBe(false);
      expect(isExternalDependency('../shared/types', lang, emptyProjectFiles)).toBe(false);
    });

    it('should NOT filter project files present in projectFiles set', () => {
      const projectFiles = new Set(['src/utils.ts', 'src/shared/types.ts']);
      // These are project files with dot in name (file extensions)
      expect(isExternalDependency('src/utils.ts', lang, projectFiles)).toBe(false);
    });
  });

  // ── isExternalDependency — Python ──

  describe('isExternalDependency — python', () => {
    const lang: SupportedLanguage = 'python';

    it('should filter Python stdlib modules', () => {
      expect(isExternalDependency('os', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('sys', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('json', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('datetime', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('pathlib', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('typing', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('asyncio', lang, emptyProjectFiles)).toBe(true);
    });

    it('should filter Python stdlib submodules', () => {
      expect(isExternalDependency('os.path', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('collections.abc', lang, emptyProjectFiles)).toBe(true);
    });

    it('should NOT filter relative imports', () => {
      expect(isExternalDependency('./models', lang, emptyProjectFiles)).toBe(false);
      expect(isExternalDependency('../utils', lang, emptyProjectFiles)).toBe(false);
    });
  });

  // ── isExternalDependency — Go ──

  describe('isExternalDependency — go', () => {
    const lang: SupportedLanguage = 'go';

    it('should filter Go stdlib (no dots = stdlib)', () => {
      expect(isExternalDependency('fmt', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('net/http', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('encoding/json', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('context', lang, emptyProjectFiles)).toBe(true);
    });

    it('should NOT filter third-party Go packages (has dots)', () => {
      expect(isExternalDependency('github.com/gin-gonic/gin', lang, emptyProjectFiles)).toBe(false);
      expect(isExternalDependency('golang.org/x/crypto', lang, emptyProjectFiles)).toBe(false);
    });
  });

  // ── isExternalDependency — Rust ──

  describe('isExternalDependency — rust', () => {
    const lang: SupportedLanguage = 'rust';

    it('should filter Rust stdlib crates', () => {
      expect(isExternalDependency('std::collections::HashMap', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('core::fmt', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('alloc::vec', lang, emptyProjectFiles)).toBe(true);
    });

    it('should NOT filter external crates', () => {
      expect(isExternalDependency('serde::Serialize', lang, emptyProjectFiles)).toBe(false);
      expect(isExternalDependency('tokio::runtime', lang, emptyProjectFiles)).toBe(false);
    });
  });

  // ── isExternalDependency — Java ──

  describe('isExternalDependency — java', () => {
    const lang: SupportedLanguage = 'java';

    it('should filter Java stdlib packages', () => {
      expect(isExternalDependency('java.util.List', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('java.io.File', lang, emptyProjectFiles)).toBe(true);
      expect(isExternalDependency('javax.servlet.http', lang, emptyProjectFiles)).toBe(true);
    });

    it('should NOT filter third-party Java packages', () => {
      expect(isExternalDependency('com.google.gson.Gson', lang, emptyProjectFiles)).toBe(false);
      expect(isExternalDependency('org.springframework.boot', lang, emptyProjectFiles)).toBe(false);
    });
  });
});
