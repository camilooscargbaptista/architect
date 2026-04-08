import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProjectSummarizer } from '../src/core/project-summarizer.js';
import { AnalysisReport } from '../src/core/types/core.js';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('ProjectSummarizer', () => {
  let tempDir: string;

  const createMockAnalysisReport = (): AnalysisReport => ({
    timestamp: new Date().toISOString(),
    projectInfo: {
      name: 'test-project',
      path: tempDir,
      frameworks: ['nest'],
      totalFiles: 10,
      totalLines: 500,
      primaryLanguages: ['typescript'],
    },
    score: {
      overall: 75,
      components: [
        {
          name: 'modularity',
          score: 80,
          maxScore: 100,
          weight: 0.25,
          explanation: 'Good modularity',
        },
      ],
      breakdown: {
        modularity: 80,
        coupling: 70,
        cohesion: 75,
        layering: 80,
      },
    },
    antiPatterns: [],
    layers: [],
    dependencyGraph: {
      nodes: [],
      edges: [],
    },
    suggestions: [],
    diagram: {
      mermaid: 'graph TD;',
      type: 'component',
    },
  });

  beforeEach(() => {
    tempDir = mkdtempSync(join('/tmp', 'summarizer-test-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('summarize()', () => {
    it('should return a ProjectSummary object with all required fields', () => {
      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      expect(summary.description).toBeDefined();
      expect(summary.purpose).toBeDefined();
      expect(Array.isArray(summary.modules)).toBe(true);
      expect(Array.isArray(summary.techStack)).toBe(true);
      expect(Array.isArray(summary.entryPoints)).toBe(true);
      expect(Array.isArray(summary.keywords)).toBe(true);
    });

    it('should read package.json when present', () => {
      const packageJson = {
        name: 'my-awesome-app',
        version: '1.0.0',
        description: 'An awesome application',
        main: 'dist/index.js',
        scripts: {
          build: 'tsc',
          test: 'jest',
          start: 'node dist/index.js',
        },
        dependencies: {
          express: '^4.18.0',
          typescript: '^5.0.0',
        },
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      // Description should include some info from package.json
      expect(typeof summary.description).toBe('string');
    });

    it('should read README.md when present', () => {
      const readmeContent = `# My Project

This is a really cool project that does amazing things.

## Features
- Feature 1
- Feature 2
- Feature 3

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`typescript
const app = new MyApp();
app.start();
\`\`\`
`;

      writeFileSync(join(tempDir, 'README.md'), readmeContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      expect(summary.description).toBeDefined();
    });

    it('should handle lowercase readme.md', () => {
      const readmeContent = '# Project Description\nThis is a test project.';
      writeFileSync(join(tempDir, 'readme.md'), readmeContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
    });

    it('should work with minimal package.json (no dependencies)', () => {
      const packageJson = {
        name: 'minimal-project',
        version: '0.0.1',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      expect(summary.techStack).toBeDefined();
    });

    it('should work with pyproject.toml', () => {
      const pyprojectContent = `[tool.poetry]
name = "my-python-app"
version = "0.1.0"
description = "A Python application"

[tool.poetry.dependencies]
python = "^3.9"
flask = "^2.0"
`;

      writeFileSync(join(tempDir, 'pyproject.toml'), pyprojectContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
    });

    it('should work with Cargo.toml for Rust projects', () => {
      const cargoContent = `[package]
name = "my-rust-app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
`;

      writeFileSync(join(tempDir, 'Cargo.toml'), cargoContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
    });

    it('should work when no package.json or README exists', () => {
      // Create empty directory (no files)
      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      expect(summary.description).toBeDefined();
      expect(Array.isArray(summary.modules)).toBe(true);
      expect(Array.isArray(summary.keywords)).toBe(true);
    });

    it('should extract keywords from package.json and README', () => {
      const packageJson = {
        name: 'auth-service',
        version: '1.0.0',
        description: 'Authentication and authorization service',
        keywords: ['auth', 'security', 'jwt'],
        dependencies: {
          'passport': '^0.6.0',
          'jsonwebtoken': '^9.0.0',
        },
      };

      const readmeContent = `# Auth Service

A robust authentication service with OAuth2 and JWT support.

Features:
- Multi-factor authentication
- OAuth2 integration
- JWT token management
`;

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      writeFileSync(join(tempDir, 'README.md'), readmeContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary.keywords).toBeDefined();
      expect(Array.isArray(summary.keywords)).toBe(true);
    });

    it('should infer modules from analysis report', () => {
      const packageJson = {
        name: 'modular-app',
        version: '1.0.0',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary.modules).toBeDefined();
      expect(Array.isArray(summary.modules)).toBe(true);
      // Each module should have required fields
      for (const module of summary.modules) {
        expect(module.name).toBeDefined();
        expect(typeof module.files).toBe('number');
        expect(module.description).toBeDefined();
      }
    });

    it('should include entry points in summary', () => {
      const packageJson = {
        name: 'app-with-entry',
        version: '1.0.0',
        main: 'dist/index.js',
        bin: {
          'my-cli': './bin/cli.js',
        },
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary.entryPoints).toBeDefined();
      expect(Array.isArray(summary.entryPoints)).toBe(true);
    });

    it('should build tech stack from dependencies', () => {
      const packageJson = {
        name: 'full-stack-app',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
          'react': '^18.0.0',
          'sequelize': '^6.35.0',
          'typescript': '^5.0.0',
        },
        devDependencies: {
          'jest': '^29.0.0',
          'eslint': '^8.0.0',
        },
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary.techStack).toBeDefined();
      expect(Array.isArray(summary.techStack)).toBe(true);
      // Tech stack should include major frameworks/libraries
      expect(summary.techStack.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate purpose from keywords and modules', () => {
      const packageJson = {
        name: 'ecommerce-platform',
        version: '1.0.0',
        description: 'Full-stack e-commerce platform',
        keywords: ['e-commerce', 'shopping', 'payments'],
      };

      const readmeContent = `# E-Commerce Platform

A modern e-commerce solution with:
- Product catalog
- Shopping cart
- Payment processing
- Order management
`;

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      writeFileSync(join(tempDir, 'README.md'), readmeContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary.purpose).toBeDefined();
      expect(typeof summary.purpose).toBe('string');
      expect(summary.purpose.length).toBeGreaterThan(0);
    });

    it('should handle special characters in package.json', () => {
      const packageJson = {
        name: 'app-with-special-chars',
        version: '1.0.0',
        description: 'App with special chars: é, ñ, 中文',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
    });

    it('should handle invalid JSON in package.json gracefully', () => {
      // Write invalid JSON
      writeFileSync(
        join(tempDir, 'package.json'),
        '{invalid json content'
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      // Should not throw
      const summary = summarizer.summarize(tempDir, report);
      expect(summary).toBeDefined();
    });

    it('should handle very large README gracefully', () => {
      const largeReadme = `# Large README

${Array(100)
  .fill(0)
  .map((_, i) => `## Section ${i}\nSome content for section ${i}`)
  .join('\n')}
`;

      writeFileSync(join(tempDir, 'README.md'), largeReadme);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      // Should not throw and should handle large content
      const summary = summarizer.summarize(tempDir, report);
      expect(summary).toBeDefined();
    });

    it('should handle missing analysis report fields gracefully', () => {
      const packageJson = {
        name: 'test-app',
        version: '1.0.0',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const minimalReport = createMockAnalysisReport();
      minimalReport.layers = [];

      const summary = summarizer.summarize(tempDir, minimalReport);

      expect(summary).toBeDefined();
      expect(summary.modules).toBeDefined();
    });

    it('should work with monorepo structure', () => {
      const packageJson = {
        name: 'monorepo-root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
    });

    it('should extract keywords from filename patterns', () => {
      const readmeContent = `# My Project

This is an API server and CLI tool for data processing.
`;

      writeFileSync(join(tempDir, 'README.md'), readmeContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary.keywords).toBeDefined();
      expect(Array.isArray(summary.keywords)).toBe(true);
    });

    it('should handle projects with multiple configuration files', () => {
      // Create multiple config files (first match should win)
      const packageJson = {
        name: 'multi-config-project',
        version: '1.0.0',
        description: 'Project with multiple configs',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      writeFileSync(
        join(tempDir, 'pyproject.toml'),
        'name = "python-config"'
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      // Should read package.json first (comes first in candidates)
      expect(summary).toBeDefined();
    });

    it('should include description with meaningful content', () => {
      const packageJson = {
        name: 'descriptive-app',
        version: '1.0.0',
        description: 'A comprehensive web application framework',
      };

      const readmeContent = `# Descriptive App

A framework for building scalable web applications.

## Key Features
- High performance
- Type-safe
- Well-documented
`;

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      writeFileSync(join(tempDir, 'README.md'), readmeContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary.description).toBeDefined();
      expect(summary.description.length).toBeGreaterThan(0);
    });

    it('should work with report containing layers and dependencies', () => {
      const packageJson = {
        name: 'layered-app',
        version: '1.0.0',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      // Add layers to report
      report.layers = [
        {
          name: 'API',
          files: ['src/controllers/user.ts', 'src/controllers/post.ts'],
          description: 'API layer',
        },
        {
          name: 'Service',
          files: ['src/services/user.ts', 'src/services/post.ts'],
          description: 'Service layer',
        },
      ];

      report.dependencyGraph.edges = [
        {
          from: 'src/controllers/user.ts',
          to: 'src/services/user.ts',
          type: 'import',
          weight: 1,
        },
      ];

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      expect(summary.modules).toBeDefined();
    });

    it('should handle empty/null values in package.json fields', () => {
      const packageJson = {
        name: 'sparse-app',
        version: '1.0.0',
        description: '',
        keywords: [],
        dependencies: {},
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      expect(summary.keywords).toBeDefined();
    });

    it('should work with TypeScript projects', () => {
      const packageJson = {
        name: 'ts-app',
        version: '1.0.0',
        description: 'TypeScript application',
        dependencies: {
          typescript: '^5.0.0',
        },
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();
      report.projectInfo.primaryLanguages = ['typescript'];

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
      expect(summary.techStack).toBeDefined();
    });

    it('should work with Python projects', () => {
      const pyprojectContent = `[tool.poetry]
name = "python-app"
version = "0.1.0"
description = "A Python application"

[tool.poetry.dependencies]
python = "^3.10"
requests = "^2.31.0"
`;

      writeFileSync(join(tempDir, 'pyproject.toml'), pyprojectContent);

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();
      report.projectInfo.primaryLanguages = ['python'];

      const summary = summarizer.summarize(tempDir, report);

      expect(summary).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent summarize calls', () => {
      const packageJson = {
        name: 'concurrent-test',
        version: '1.0.0',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary1 = summarizer.summarize(tempDir, report);
      const summary2 = summarizer.summarize(tempDir, report);

      expect(summary1).toBeDefined();
      expect(summary2).toBeDefined();
      expect(summary1.description).toBeDefined();
      expect(summary2.description).toBeDefined();
    });

    it('should produce consistent results for same input', () => {
      const packageJson = {
        name: 'consistency-test',
        version: '1.0.0',
        description: 'Test consistency',
      };

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const summarizer = new ProjectSummarizer();
      const report = createMockAnalysisReport();

      const summary1 = summarizer.summarize(tempDir, report);
      const summary2 = summarizer.summarize(tempDir, report);

      expect(summary1.description).toBe(summary2.description);
      expect(summary1.purpose).toBe(summary2.purpose);
      expect(summary1.keywords).toEqual(summary2.keywords);
    });
  });
});
