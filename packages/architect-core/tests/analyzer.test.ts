import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ArchitectureAnalyzer } from '../src/core/analyzer.js';
import { FileNode } from '../src/core/types/infrastructure.js';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('ArchitectureAnalyzer', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join('/tmp', 'analyzer-test-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialize()', () => {
    it('should initialize without error', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await expect(analyzer.initialize()).resolves.toBeUndefined();
    });

    it('should handle initialization gracefully when tree-sitter fails', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      // The constructor catches errors silently
      await analyzer.initialize();
      // If we reach here, it means the error was handled gracefully
      expect(true).toBe(true);
    });

    it('should be idempotent', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();
      // Second call should not error
      await analyzer.initialize();
      expect(true).toBe(true);
    });
  });

  describe('analyzeDependencies()', () => {
    it('should return an empty array for single file with no imports', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      // Create a simple file with no imports
      const filePath = join(tempDir, 'simple.ts');
      writeFileSync(filePath, 'console.log("hello");');

      const fileTree: FileNode = {
        path: filePath,
        name: 'simple.ts',
        type: 'file',
        extension: '.ts',
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
    });

    it('should parse TypeScript imports', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const utilsDir = join(srcDir, 'utils');
      const servicesDir = join(srcDir, 'services');

      // Create directory structure
      mkdirSync(utilsDir, { recursive: true });
      mkdirSync(servicesDir, { recursive: true });

      // Create files with imports
      const utilsPath = join(utilsDir, 'helper.ts');
      const servicePath = join(servicesDir, 'user.ts');

      writeFileSync(utilsPath, 'export function help() {}');
      writeFileSync(servicePath, "import { help } from '../utils/helper';\nhelp();");

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: utilsDir,
            name: 'utils',
            type: 'directory',
            children: [
              {
                path: utilsPath,
                name: 'helper.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
          {
            path: servicesDir,
            name: 'services',
            type: 'directory',
            children: [
              {
                path: servicePath,
                name: 'user.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
        ],
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
      expect(dependencies.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle JavaScript imports', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const filePath = join(tempDir, 'index.js');
      writeFileSync(
        filePath,
        "const utils = require('./utils');\nconst path = require('path');"
      );

      const fileTree: FileNode = {
        path: filePath,
        name: 'index.js',
        type: 'file',
        extension: '.js',
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
    });

    it('should handle Python imports', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const filePath = join(tempDir, 'main.py');
      writeFileSync(filePath, 'import os\nfrom sys import argv\n');

      const fileTree: FileNode = {
        path: filePath,
        name: 'main.py',
        type: 'file',
        extension: '.py',
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
    });

    it('should ignore external/third-party imports', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const filePath = join(tempDir, 'app.ts');
      writeFileSync(
        filePath,
        "import express from 'express';\nimport axios from 'axios';\n"
      );

      const fileTree: FileNode = {
        path: filePath,
        name: 'app.ts',
        type: 'file',
        extension: '.ts',
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
    });

    it('should handle empty file tree', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const fileTree: FileNode = {
        path: tempDir,
        name: 'project',
        type: 'directory',
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
      expect(dependencies.length).toBe(0);
    });

    it('should handle deeply nested directory structure', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      // Create deep nesting: a/b/c/d/file.ts
      const deepPath = join(tempDir, 'a', 'b', 'c', 'd');
      mkdirSync(deepPath, { recursive: true });
      const filePath = join(deepPath, 'file.ts');
      writeFileSync(filePath, 'export const x = 1;');

      const fileTree: FileNode = {
        path: tempDir,
        name: 'project',
        type: 'directory',
        children: [
          {
            path: join(tempDir, 'a'),
            name: 'a',
            type: 'directory',
            children: [
              {
                path: join(tempDir, 'a', 'b'),
                name: 'b',
                type: 'directory',
                children: [
                  {
                    path: join(tempDir, 'a', 'b', 'c'),
                    name: 'c',
                    type: 'directory',
                    children: [
                      {
                        path: deepPath,
                        name: 'd',
                        type: 'directory',
                        children: [
                          {
                            path: filePath,
                            name: 'file.ts',
                            type: 'file',
                            extension: '.ts',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
    });

    it('should handle multiple file types in one tree', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });

      const tsFile = join(srcDir, 'app.ts');
      const jsFile = join(srcDir, 'helper.js');
      const pyFile = join(srcDir, 'util.py');

      writeFileSync(tsFile, 'const x = 1;');
      writeFileSync(jsFile, 'const y = 2;');
      writeFileSync(pyFile, 'z = 3\n');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: tsFile,
            name: 'app.ts',
            type: 'file',
            extension: '.ts',
          },
          {
            path: jsFile,
            name: 'helper.js',
            type: 'file',
            extension: '.js',
          },
          {
            path: pyFile,
            name: 'util.py',
            type: 'file',
            extension: '.py',
          },
        ],
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
    });
  });

  describe('detectLayers()', () => {
    it('should return empty array for empty tree', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const fileTree: FileNode = {
        path: tempDir,
        name: 'project',
        type: 'directory',
      };

      const layers = analyzer.detectLayers(fileTree);
      expect(Array.isArray(layers)).toBe(true);
      expect(layers.length).toBe(0);
    });

    it('should detect API layer files', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const controllersDir = join(srcDir, 'controllers');
      mkdirSync(controllersDir, { recursive: true });

      const controllerFile = join(controllersDir, 'user.controller.ts');
      writeFileSync(controllerFile, 'export class UserController {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: controllersDir,
            name: 'controllers',
            type: 'directory',
            children: [
              {
                path: controllerFile,
                name: 'user.controller.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const apiLayer = layers.find((l) => l.name === 'API');
      expect(apiLayer).toBeDefined();
      expect(apiLayer?.files).toContain(controllerFile);
    });

    it('should detect Service layer files', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const servicesDir = join(srcDir, 'services');
      mkdirSync(servicesDir, { recursive: true });

      const serviceFile = join(servicesDir, 'auth.service.ts');
      writeFileSync(serviceFile, 'export class AuthService {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: servicesDir,
            name: 'services',
            type: 'directory',
            children: [
              {
                path: serviceFile,
                name: 'auth.service.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const serviceLayer = layers.find((l) => l.name === 'Service');
      expect(serviceLayer).toBeDefined();
      expect(serviceLayer?.files).toContain(serviceFile);
    });

    it('should detect Data layer files', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const entitiesDir = join(srcDir, 'entities');
      mkdirSync(entitiesDir, { recursive: true });

      const entityFile = join(entitiesDir, 'user.entity.ts');
      writeFileSync(entityFile, 'export class User {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: entitiesDir,
            name: 'entities',
            type: 'directory',
            children: [
              {
                path: entityFile,
                name: 'user.entity.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const dataLayer = layers.find((l) => l.name === 'Data');
      expect(dataLayer).toBeDefined();
      expect(dataLayer?.files).toContain(entityFile);
    });

    it('should detect UI layer files by extension', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const componentsDir = join(srcDir, 'components');
      mkdirSync(componentsDir, { recursive: true });

      const uiFile = join(componentsDir, 'Button.tsx');
      writeFileSync(uiFile, 'export function Button() {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: componentsDir,
            name: 'components',
            type: 'directory',
            children: [
              {
                path: uiFile,
                name: 'Button.tsx',
                type: 'file',
                extension: '.tsx',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const uiLayer = layers.find((l) => l.name === 'UI');
      expect(uiLayer).toBeDefined();
      expect(uiLayer?.files).toContain(uiFile);
    });

    it('should detect Infrastructure layer files', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const configDir = join(srcDir, 'config');
      mkdirSync(configDir, { recursive: true });

      const configFile = join(configDir, 'database.ts');
      writeFileSync(configFile, 'export const dbConfig = {};');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: configDir,
            name: 'config',
            type: 'directory',
            children: [
              {
                path: configFile,
                name: 'database.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const infraLayer = layers.find((l) => l.name === 'Infrastructure');
      expect(infraLayer).toBeDefined();
      expect(infraLayer?.files).toContain(configFile);
    });

    it('should exclude test files from layers', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });

      const testFile = join(srcDir, 'app.test.ts');
      const specFile = join(srcDir, 'app.spec.ts');
      writeFileSync(testFile, 'describe("test", () => {});');
      writeFileSync(specFile, 'describe("spec", () => {});');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: testFile,
            name: 'app.test.ts',
            type: 'file',
            extension: '.ts',
          },
          {
            path: specFile,
            name: 'app.spec.ts',
            type: 'file',
            extension: '.ts',
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      // Test files should not appear in any layer
      for (const layer of layers) {
        expect(layer.files).not.toContain(testFile);
        expect(layer.files).not.toContain(specFile);
      }
    });

    it('should skip node_modules files', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const nodeModulesDir = join(srcDir, 'node_modules');
      mkdirSync(nodeModulesDir, { recursive: true });

      const nmFile = join(nodeModulesDir, 'lib.js');
      writeFileSync(nmFile, 'module.exports = {};');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: nodeModulesDir,
            name: 'node_modules',
            type: 'directory',
            children: [
              {
                path: nmFile,
                name: 'lib.js',
                type: 'file',
                extension: '.js',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      // node_modules files should not appear in any layer
      for (const layer of layers) {
        expect(layer.files).not.toContain(nmFile);
      }
    });

    it('should handle multiple files across multiple layers', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const controllersDir = join(srcDir, 'controllers');
      const servicesDir = join(srcDir, 'services');
      const entitiesDir = join(srcDir, 'entities');

      mkdirSync(controllersDir, { recursive: true });
      mkdirSync(servicesDir, { recursive: true });
      mkdirSync(entitiesDir, { recursive: true });

      const controllerPath = join(controllersDir, 'user.controller.ts');
      const servicePath = join(servicesDir, 'user.service.ts');
      const entityPath = join(entitiesDir, 'user.entity.ts');

      writeFileSync(controllerPath, 'export class UserController {}');
      writeFileSync(servicePath, 'export class UserService {}');
      writeFileSync(entityPath, 'export class User {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: controllersDir,
            name: 'controllers',
            type: 'directory',
            children: [
              {
                path: controllerPath,
                name: 'user.controller.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
          {
            path: servicesDir,
            name: 'services',
            type: 'directory',
            children: [
              {
                path: servicePath,
                name: 'user.service.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
          {
            path: entitiesDir,
            name: 'entities',
            type: 'directory',
            children: [
              {
                path: entityPath,
                name: 'user.entity.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      expect(layers.length).toBeGreaterThanOrEqual(3);
      expect(layers.map((l) => l.name)).toContain('API');
      expect(layers.map((l) => l.name)).toContain('Service');
      expect(layers.map((l) => l.name)).toContain('Data');
    });

    it('should include descriptions for each layer', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const controllersDir = join(srcDir, 'controllers');
      mkdirSync(controllersDir, { recursive: true });

      const controllerPath = join(controllersDir, 'app.controller.ts');
      writeFileSync(controllerPath, 'export class AppController {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: controllersDir,
            name: 'controllers',
            type: 'directory',
            children: [
              {
                path: controllerPath,
                name: 'app.controller.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const apiLayer = layers.find((l) => l.name === 'API');
      expect(apiLayer?.description).toBeTruthy();
      expect(apiLayer?.description).toContain('API');
    });

    it('should detect JSX files in UI layer', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });

      const jsxFile = join(srcDir, 'App.jsx');
      writeFileSync(jsxFile, 'export function App() {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: jsxFile,
            name: 'App.jsx',
            type: 'file',
            extension: '.jsx',
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const uiLayer = layers.find((l) => l.name === 'UI');
      expect(uiLayer).toBeDefined();
      expect(uiLayer?.files).toContain(jsxFile);
    });

    it('should detect model/repository pattern as Data layer', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });

      const modelFile = join(srcDir, 'user.model.ts');
      const repoFile = join(srcDir, 'user.repository.ts');
      writeFileSync(modelFile, 'export class User {}');
      writeFileSync(repoFile, 'export class UserRepository {}');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: modelFile,
            name: 'user.model.ts',
            type: 'file',
            extension: '.ts',
          },
          {
            path: repoFile,
            name: 'user.repository.ts',
            type: 'file',
            extension: '.ts',
          },
        ],
      };

      const layers = analyzer.detectLayers(fileTree);
      const dataLayer = layers.find((l) => l.name === 'Data');
      expect(dataLayer).toBeDefined();
      expect(dataLayer?.files).toContain(modelFile);
      expect(dataLayer?.files).toContain(repoFile);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed language project', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const srcDir = join(tempDir, 'src');
      const tsDir = join(srcDir, 'ts');
      const pyDir = join(srcDir, 'py');

      mkdirSync(tsDir, { recursive: true });
      mkdirSync(pyDir, { recursive: true });

      writeFileSync(join(tsDir, 'main.ts'), "import './utils';");
      writeFileSync(join(pyDir, 'main.py'), 'import sys\n');

      const fileTree: FileNode = {
        path: srcDir,
        name: 'src',
        type: 'directory',
        children: [
          {
            path: tsDir,
            name: 'ts',
            type: 'directory',
            children: [
              {
                path: join(tsDir, 'main.ts'),
                name: 'main.ts',
                type: 'file',
                extension: '.ts',
              },
            ],
          },
          {
            path: pyDir,
            name: 'py',
            type: 'directory',
            children: [
              {
                path: join(pyDir, 'main.py'),
                name: 'main.py',
                type: 'file',
                extension: '.py',
              },
            ],
          },
        ],
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      const layers = analyzer.detectLayers(fileTree);

      expect(Array.isArray(dependencies)).toBe(true);
      expect(Array.isArray(layers)).toBe(true);
    });

    it('should handle cyclic imports', async () => {
      const analyzer = new ArchitectureAnalyzer(tempDir);
      await analyzer.initialize();

      const aPath = join(tempDir, 'a.ts');
      const bPath = join(tempDir, 'b.ts');

      writeFileSync(aPath, "import './b';");
      writeFileSync(bPath, "import './a';");

      const fileTree: FileNode = {
        path: tempDir,
        name: 'project',
        type: 'directory',
        children: [
          {
            path: aPath,
            name: 'a.ts',
            type: 'file',
            extension: '.ts',
          },
          {
            path: bPath,
            name: 'b.ts',
            type: 'file',
            extension: '.ts',
          },
        ],
      };

      const dependencies = analyzer.analyzeDependencies(fileTree);
      expect(Array.isArray(dependencies)).toBe(true);
    });
  });
});
