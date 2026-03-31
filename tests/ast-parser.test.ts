import { TreeSitterParser } from '../src/core/ast/tree-sitter-parser.js';

describe('TreeSitter AST Parser', () => {
  let parser: TreeSitterParser;

  beforeAll(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();
  });

  describe('TypeScript/JavaScript Parsing', () => {
    it('should parse standard ES6 imports', () => {
      const code = `
        import { MyService } from './my.service';
        import React from 'react';
        import * as utils from '@/utils';
      `;
      const imports = parser.parseImports(code, 'foo.ts');
      expect(imports).toContain('./my.service');
      expect(imports).toContain('react');
      expect(imports).toContain('@/utils');
    });

    it('should parse CommonJS require calls', () => {
      const code = `
        const fs = require('fs');
        const custom = require('../custom/module');
      `;
      const imports = parser.parseImports(code, 'foo.js');
      expect(imports).toContain('fs');
      expect(imports).toContain('../custom/module');
    });

    it('should parse dynamic imports', () => {
      const code = `
        async function load() {
          const mod = await import('./lazy-module');
        }
      `;
      const imports = parser.parseImports(code, 'foo.ts');
      expect(imports).toContain('./lazy-module');
    });

    it('should parse re-exports', () => {
      const code = `
        export * from './domain/models';
        export { User } from './domain/user';
      `;
      const imports = parser.parseImports(code, 'index.ts');
      expect(imports).toContain('./domain/models');
      expect(imports).toContain('./domain/user');
    });
  });

  describe('Python Parsing', () => {
    it('should parse standard python imports', () => {
      const code = `
from os import path
import sys
from my_module.submodule import MyClass
import internal_app as app
      `;
      const imports = parser.parseImports(code, 'main.py');
      expect(imports).toContain('os'); // AST only extracts the module name or dotted name
      expect(imports).toContain('sys');
      expect(imports).toContain('my_module.submodule');
      expect(imports).toContain('internal_app');
    });
  });

  describe('Go Parsing', () => {
    it('should parse go imports', () => {
      const code = `
package main

import (
  "fmt"
  "github.com/myorg/myproject/internal/utils"
)
import "os"
      `;
      const imports = parser.parseImports(code, 'main.go');
      expect(imports).toContain('fmt');
      expect(imports).toContain('github.com/myorg/myproject/internal/utils');
      expect(imports).toContain('os');
    });
  });

  describe('Java Parsing', () => {
    it('should parse java imports', () => {
      const code = `
package com.example;

import java.util.List;
import com.example.internal.MyService;
      `;
      const imports = parser.parseImports(code, 'Main.java');
      expect(imports).toContain('java.util.List');
      expect(imports).toContain('com.example.internal.MyService');
    });
  });
});
