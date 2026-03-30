import fs from 'fs';
import path from 'path';

const targets = [
  'scripts/decompose-detectors.ts'
];

let processed = 0;

for (const target of targets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${target}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /^import\s+([^'"]+)\s+from\s+['"]([^'"]+)['"];?/gm;
  
  const depsExports = [];
  const localImports = [];
  
  let match;
  let remainingContent = content;

  // We must process ALL imports from relative local files (starts with '.' or '..')
  while ((match = importRegex.exec(content)) !== null) {
    const fullStatement = match[0];
    const bindingsRaw = match[1].trim();
    const source = match[2];
    
    // Skip absolute module imports like 'fs' or 'path' or 'vitest'
    if (!source.startsWith('.')) continue;

    // Remove this import statement from original file
    remainingContent = remainingContent.replace(fullStatement, '');

    // Parse bindings
    // Cases:
    // 1. { A, B as C }
    // 2. defaultExport
    // 3. * as ns
    // 4. defaultExport, { A, B }
    
    let defaultImport = null;
    let namedImports = [];
    let namespaceImport = null;

    if (bindingsRaw.startsWith('* as ')) {
      namespaceImport = bindingsRaw.substring(5).trim();
    } else {
      let rest = bindingsRaw;
      if (!bindingsRaw.startsWith('{')) {
        const parts = bindingsRaw.split(',');
        defaultImport = parts[0].trim();
        rest = parts.slice(1).join(',').trim();
      }
      if (rest.startsWith('{') && rest.endsWith('}')) {
        const enclosed = rest.slice(1, -1);
        namedImports = enclosed.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Generate exports for _deps.ts
    // Generate new import names for Original file
    const exportPieces = [];
    const importPieces = [];

    if (defaultImport) {
       exportPieces.push(`default as ${defaultImport}`);
       importPieces.push(defaultImport);
    }
    
    if (namedImports.length > 0) {
      const namedStr = namedImports.join(', ');
      exportPieces.push(namedStr);
      
      const localNamesStr = namedImports.map(n => {
        const asIdx = n.indexOf(' as ');
        return asIdx !== -1 ? n.substring(asIdx + 4).trim() : n;
      }).join(', ');
      
      importPieces.push(localNamesStr);
    }

    if (namespaceImport) {
       depsExports.push(`export * as ${namespaceImport} from '${source}';`);
       localImports.push(namespaceImport);
    } else {
       depsExports.push(`export { ${exportPieces.join(', ')} } from '${source}';`);
    }

    if (importPieces.length > 0) {
       localImports.push(...importPieces);
    }
  }

  if (depsExports.length > 0) {
    // Write _deps.ts
    const ext = path.extname(target);
    const depsFileRelative = target.replace(ext, '_deps' + ext);
    const depsFilePath = path.resolve(depsFileRelative);
    
    fs.writeFileSync(depsFilePath, depsExports.join('\n') + '\n', 'utf8');

    // Add unified import to original file
    const newRelativeStr = './' + path.basename(depsFileRelative).replace('.ts', '.js');
    
    // Build the final import statement
    // For simplicity, we just import all locals as named imports from deps?
    // Wait, some might be default. But _deps re-exports them as named imports! (export { default as Foo })
    // So the original file just imports { Foo } from './..._deps.js'.
    const unifiedImportStr = `import { ${localImports.join(', ')} } from '${newRelativeStr}';\n`;

    // Put it at the top
    remainingContent = unifiedImportStr + '\n' + remainingContent.replace(/^\s+/, '');
    
    fs.writeFileSync(filePath, remainingContent, 'utf8');
    processed++;
  }
}

console.log(`Processed ${processed} files and created their _deps equivalents.`);
