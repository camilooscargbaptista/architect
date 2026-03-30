import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..'); // project root /src

const files = globSync('**/*.ts', { cwd: rootDir, absolute: true });

// Map from original src path to new src path
const movedMap = {
  'analyzer.ts': 'core/analyzer.ts',
  'anti-patterns.ts': 'core/anti-patterns.ts',
  'config.ts': 'core/config.ts',
  'diagram.ts': 'core/diagram.ts',
  'project-summarizer.ts': 'core/project-summarizer.ts',
  'refactor-engine.ts': 'core/refactor-engine.ts',
  'scorer.ts': 'core/scorer.ts',
  'types.ts': 'core/types.ts',
  'scanner.ts': 'infrastructure/scanner.ts',
  'logger.ts': 'infrastructure/logger.ts',
  'cli.ts': 'adapters/cli.ts',
  'html-reporter.ts': 'adapters/html-reporter.ts',
  'refactor-reporter.ts': 'adapters/refactor-reporter.ts',
  'reporter.ts': 'adapters/reporter.ts',
  'index.ts': 'core/architect.ts', // old index.ts moved to core/architect.ts
  'analyzers/git-history.ts': 'infrastructure/git-history.ts',
  'analyzers/git-cache.ts': 'infrastructure/git-cache.ts',
  'analyzers/forecast.ts': 'core/analyzers/forecast.ts',
  'analyzers/temporal-scorer.ts': 'core/analyzers/temporal-scorer.ts',
  'analyzers/index.ts': 'core/analyzers/index.ts',
};

function getOldRelPath(newPathRel) {
  for (const [oldP, newP] of Object.entries(movedMap)) {
    if (newP === newPathRel) return oldP;
  }
  if (newPathRel === 'index.ts') return 'index.ts'; // the newly created index.ts
  if (newPathRel.startsWith('core/agent-generator/')) return newPathRel.replace('core/', '');
  if (newPathRel.startsWith('core/rules/')) return newPathRel.replace('core/', '');
  if (newPathRel.startsWith('core/summarizer/')) return newPathRel.replace('core/', '');
  if (newPathRel.startsWith('adapters/html-reporter/')) return newPathRel.replace('adapters/', '');
  return newPathRel; 
}

function getNewRelPath(oldPathRel) {
  for (const [oldP, newP] of Object.entries(movedMap)) {
    if (oldP === oldPathRel) return newP;
  }
  if (oldPathRel.startsWith('agent-generator/')) return 'core/' + oldPathRel;
  if (oldPathRel.startsWith('rules/')) return 'core/' + oldPathRel;
  if (oldPathRel.startsWith('summarizer/')) return 'core/' + oldPathRel;
  if (oldPathRel.startsWith('html-reporter/')) return 'adapters/' + oldPathRel;
  return oldPathRel;
}

for (const file of files) {
  if (file.includes('scripts/fix-imports')) continue;
  
  const content = fs.readFileSync(file, 'utf-8');
  const currentNewRel = path.relative(rootDir, file);
  
  // What was the old path of this file BEFORE the move?
  const currentOldRel = getOldRelPath(currentNewRel);
  
  let modified = false;
  
  const newContent = content.replace(/(from|import)\s+['"]([^'"]+)['"]/g, (match, prefix, importPath) => {
    // Only process relative imports
    if (!importPath.startsWith('.')) return match;
    
    // JS imports have .js extension. Convert for lookups.
    const importIsJs = importPath.endsWith('.js');
    const cleanImportPath = importPath.replace(/\.js$/, '.ts');
    
    // 1. Resolve to old absolute path relative to currentOldRel
    const oldImportAbs = path.resolve(rootDir, path.dirname(currentOldRel), cleanImportPath);
    const oldImportRel = path.relative(rootDir, oldImportAbs);
    
    // 2. Where did this imported file move?
    const newImportRel = getNewRelPath(oldImportRel);
    
    // 3. Calculate new relative import from current file's new location to the new import location
    let newRelative = path.relative(path.dirname(currentNewRel), newImportRel);
    if (!newRelative.startsWith('.')) newRelative = './' + newRelative;
    
    // 4. Restore the .js extension if it was originally there
    if (importIsJs) newRelative = newRelative.replace(/\.ts$/, '.js');
    
    // Important: DO NOT run math logic if it already has too many parent traverses like `../../../../../` due to double execution!
    // Since I reset `git clean`, double execution is impossible now.
    
    if (newRelative !== importPath) {
      modified = true;
      return `${prefix} '${newRelative}'`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(file, newContent, 'utf-8');
    console.log(`Updated imports in ${currentNewRel}`);
  }
}
