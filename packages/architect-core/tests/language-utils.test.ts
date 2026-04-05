import {
  getExtension,
  getCommentSyntax,
  getBarrelFilenames,
  getModuleInitFilename,
  generateSplitFileContent,
  generateFacadeContent,
} from '../src/core/utils/language-utils.js';

describe('LanguageUtils', () => {
  // ── getExtension ──

  describe('getExtension', () => {
    it('should return correct extensions for all languages', () => {
      expect(getExtension('typescript')).toBe('ts');
      expect(getExtension('javascript')).toBe('js');
      expect(getExtension('python')).toBe('py');
      expect(getExtension('go')).toBe('go');
      expect(getExtension('rust')).toBe('rs');
      expect(getExtension('java')).toBe('java');
    });
  });

  // ── getCommentSyntax ──

  describe('getCommentSyntax', () => {
    it('should return // for TypeScript', () => {
      expect(getCommentSyntax('typescript').line).toBe('//');
    });

    it('should return # for Python', () => {
      expect(getCommentSyntax('python').line).toBe('#');
    });

    it('should return triple-quote block comments for Python', () => {
      const py = getCommentSyntax('python');
      expect(py.blockStart).toBe('"""');
      expect(py.blockEnd).toBe('"""');
    });
  });

  // ── getBarrelFilenames ──

  describe('getBarrelFilenames', () => {
    it('should return index.ts for typescript', () => {
      expect(getBarrelFilenames('typescript').has('index.ts')).toBe(true);
    });

    it('should return __init__.py for python', () => {
      expect(getBarrelFilenames('python').has('__init__.py')).toBe(true);
    });

    it('should return mod.rs for rust', () => {
      expect(getBarrelFilenames('rust').has('mod.rs')).toBe(true);
    });

    it('should return empty set for go', () => {
      expect(getBarrelFilenames('go').size).toBe(0);
    });
  });

  // ── getModuleInitFilename ──

  describe('getModuleInitFilename', () => {
    it('should return __init__.py for python', () => {
      expect(getModuleInitFilename('python')).toBe('__init__.py');
    });

    it('should return index.ts for typescript', () => {
      expect(getModuleInitFilename('typescript')).toBe('index.ts');
    });

    it('should return mod.rs for rust', () => {
      expect(getModuleInitFilename('rust')).toBe('mod.rs');
    });
  });

  // ── generateSplitFileContent ──

  describe('generateSplitFileContent', () => {
    it('should generate Python split file with docstring', () => {
      const content = generateSplitFileContent('python', 'utils', 'auth', ['login.py', 'signup.py']);
      expect(content).toContain('"""utils_auth');
      expect(content).toContain('login.py, signup.py');
    });

    it('should generate TypeScript split file with // comments', () => {
      const content = generateSplitFileContent('typescript', 'utils', 'auth', ['login.ts']);
      expect(content).toContain('// utils_auth');
      expect(content).toContain('login.ts');
    });

    it('should generate Go split file with package declaration', () => {
      const content = generateSplitFileContent('go', 'utils', 'auth', ['login.go']);
      expect(content).toContain('package auth');
    });

    it('should generate Rust split file with //! doc comments', () => {
      const content = generateSplitFileContent('rust', 'utils', 'auth', ['login.rs']);
      expect(content).toContain('//! utils_auth');
    });

    it('should generate Java split file with Javadoc', () => {
      const content = generateSplitFileContent('java', 'utils', 'auth', ['Login.java']);
      expect(content).toContain('/**');
      expect(content).toContain('utils_auth');
    });
  });

  // ── generateFacadeContent ──

  describe('generateFacadeContent', () => {
    const targets = ['src/auth/login.ts', 'src/db/user-repo.ts'];
    const dirs = ['src/auth', 'src/db'];

    it('should generate TypeScript facade with export comments', () => {
      const content = generateFacadeContent('typescript', targets, dirs);
      expect(content).toContain('Dependency facade');
      expect(content).toContain("// export { ... } from 'src/auth/login.ts'");
    });

    it('should generate Python facade with docstring', () => {
      const content = generateFacadeContent('python', targets, dirs);
      expect(content).toContain('"""Dependency facade');
      expect(content).toContain('# from src.auth.login');
    });

    it('should generate Go facade with package declaration', () => {
      const content = generateFacadeContent('go', targets, dirs);
      expect(content).toContain('package facade');
    });

    it('should generate Rust facade with //! doc comments', () => {
      const content = generateFacadeContent('rust', targets, dirs);
      expect(content).toContain('//! Dependency facade');
      expect(content).toContain('// use src::auth::login');
    });
  });
});
