import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('tests/**/*.ts');

const mappings = [
  // Analyzers
  ['../src/analyzers/git-history.js', '../src/infrastructure/git-history.js'],
  ['../src/analyzers/git-cache.js', '../src/infrastructure/git-cache.js'],
  ['../src/analyzers/temporal-scorer.js', '../src/core/analyzers/temporal-scorer.js'],
  ['../src/analyzers/forecast.js', '../src/core/analyzers/forecast.js'],
  ['../src/analyzers/', '../src/core/analyzers/'],
  // Adapters
  ['../src/html-reporter.js', '../src/adapters/html-reporter.js'],
  ['../src/cli.js', '../src/adapters/cli.js'],
  // Infrastructure
  ['../src/scanner.js', '../src/infrastructure/scanner.js'],
  // Core
  ['../src/analyzer.js', '../src/core/analyzer.js'],
  ['../src/anti-patterns.js', '../src/core/anti-patterns.js'],
  ['../src/config.js', '../src/core/config.js'],
  ['../src/scorer.js', '../src/core/scorer.js'],
  // Core Sub-modules
  ['../src/agent-generator/', '../src/core/agent-generator/'],
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const [from, to] of mappings) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  // Handle generic `../src/types.js` splitting
  if (content.includes("../src/types.js")) {
    content = content.replace(/import \{(.*?)\} from '\.\.\/src\/types\.js';/g, (match, imports) => {
      const parts = imports.split(',').map(i => i.trim());
      const coreImports = [];
      const ruleImports = [];
      
      for (const p of parts) {
        if (p === 'RefactoringPlan' || p === 'RefactorStep' || p === 'RefactorRule' || p === 'FileOperation') {
          ruleImports.push(p);
        } else {
          coreImports.push(p);
        }
      }

      let res = '';
      if (coreImports.length > 0) res += `import { ${coreImports.join(', ')} } from '../src/core/types/core.js';\n`;
      if (ruleImports.length > 0) res += `import { ${ruleImports.join(', ')} } from '../src/core/types/rules.js';\n`;
      return res.trim();
    });
    changed = true;
  }

  if (content.includes("../src/core/agent-generator/types.js")) {
     content = content.replace(/import \{(.*?)\} from '\.\.\/src\/core\/agent-generator\/types\.js';/g, (match, imports) => {
        // Just send all Template types to template.js, Stack to stack.js
        return `import { ${imports} } from '../src/core/agent-generator/types/template.js';`;
     });
     changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Fixed imports in ${file}`);
  }
}
