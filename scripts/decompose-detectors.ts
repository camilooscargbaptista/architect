import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = 'src/agent-generator/framework-detector.ts';
const DEST_DIR = 'src/agent-generator/detectors';

if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });

// Read original
const content = readFileSync(SRC, 'utf8');

// 1. EXTRACT FRAMEWORK_MAP into framework-registry.ts
const mapMatch = content.match(/(private static readonly FRAMEWORK_MAP[\s\S]*?);/);
let mapCode = mapMatch ? mapMatch[1].replace('private static readonly', 'export const') + ';' : '';

writeFileSync(join(DEST_DIR, 'framework-registry.ts'), `import { FrameworkInfo } from '../types.js';\n\n${mapCode}\n`);

// 2. Base Detector Strategy
const baseStrategy = `import { FrameworkInfo } from '../types.js';
import { readFileSync } from 'fs';

export interface FrameworkDetectorStrategy {
  detect(projectPath: string, out: FrameworkInfo[]): void;
}

export abstract class BaseDetector implements FrameworkDetectorStrategy {
  abstract detect(projectPath: string, out: FrameworkInfo[]): void;

  protected safeReadFile(path: string): string {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return '';
    }
  }
}
`;
writeFileSync(join(DEST_DIR, 'base-detector.ts'), baseStrategy);

// 3. Extract languages
const methods = [
  { file: 'python-detector.ts', class: 'PythonDetector', method: 'detectFromPython', helpers: ['parsePythonRequirements', 'parsePyprojectToml'] },
  { file: 'node-detector.ts', class: 'NodeDetector', method: 'detectFromNodejs', helpers: [] },
  { file: 'java-detector.ts', class: 'JavaDetector', method: 'detectFromJava', helpers: [] },
  { file: 'php-detector.ts', class: 'PhpDetector', method: 'detectFromPhp', helpers: [] },
  { file: 'go-detector.ts', class: 'GoDetector', method: 'detectFromGo', helpers: [] },
  { file: 'ruby-detector.ts', class: 'RubyDetector', method: 'detectFromRuby', helpers: [] },
  { file: 'dart-detector.ts', class: 'DartDetector', method: 'detectFromDart', helpers: [] },
  { file: 'rust-detector.ts', class: 'RustDetector', method: 'detectFromRust', helpers: [] }
];

methods.forEach(def => {
  let clsBody = '';
  
  // Extract main method
  const methodRegex = new RegExp(`(private ${def.method}\\([\\s\\S]*?\\n  })\\n\\n`, 'g');
  const mainMatch = content.match(methodRegex);
  if (mainMatch) clsBody += mainMatch[0].replace('private ', 'public ') + '\n';
  else {
    const singleMatch = content.match(new RegExp(`(private ${def.method}[\\s\\S]*?)(?:\\n  private |\\n\\n  /|\\n})`));
    if (singleMatch) clsBody += singleMatch[1].replace('private ', 'public ') + '\n';
  }

  // Extract helpers
  def.helpers.forEach(h => {
    const r = new RegExp(`private ${h}\\([\\s\\S]*?\\n(?:  })\\n`);
    const m = content.match(r);
    if (m) clsBody += m[0];
  });

  // Inject FRAMEWORK_MAP usage
  clsBody = clsBody.replace(/FrameworkDetector\.FRAMEWORK_MAP/g, 'FRAMEWORK_MAP');

  const fileContent = `import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '../types.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class ${def.class} extends BaseDetector {
${clsBody.trim()}
}
`;
  writeFileSync(join(DEST_DIR, def.file), fileContent);
});

// 4. Extract Toolchain
const toolchainMatch = content.match(/(private detectToolchain[\s\S]+?)\n\n  \/\//);
let toolchainCode = toolchainMatch ? toolchainMatch[1].replace('private detectToolchain', 'public detectToolchain') : '';

const structMatch = content.match(/(private detectProjectStructure[\s\S]+?})\n\n/);
let structCode = structMatch ? structMatch[1].replace('private detectProjectStructure', 'public detectProjectStructure') : '';

writeFileSync(join(DEST_DIR, 'toolchain-detector.ts'), `import { existsSync } from 'fs';
import { join } from 'path';
import { AnalysisReport } from '../../types.js';
import { FrameworkInfo, DetectedToolchain } from '../types.js';

export class ToolchainDetector {
${toolchainCode}
}
`);

writeFileSync(join(DEST_DIR, 'structure-detector.ts'), `import { AnalysisReport } from '../../types.js';

export class StructureDetector {
${structCode}
}
`);

// 5. Build Facade Index
const facade = `import { AnalysisReport } from '../../types.js';
import { FrameworkInfo, DetectedToolchain } from './types.js';
import { PythonDetector } from './detectors/python-detector.js';
import { NodeDetector } from './detectors/node-detector.js';
import { JavaDetector } from './detectors/java-detector.js';
import { PhpDetector } from './detectors/php-detector.js';
import { GoDetector } from './detectors/go-detector.js';
import { RubyDetector } from './detectors/ruby-detector.js';
import { DartDetector } from './detectors/dart-detector.js';
import { RustDetector } from './detectors/rust-detector.js';
import { ToolchainDetector } from './detectors/toolchain-detector.js';
import { StructureDetector } from './detectors/structure-detector.js';

/**
 * FrameworkDetector — Detects actual frameworks and toolchain from dependency files.
 * Re-architected as a Strategy/Registry Facade.
 */
export class FrameworkDetector {
  private detectors = [
    new PythonDetector(),
    new NodeDetector(),
    new JavaDetector(),
    new PhpDetector(),
    new GoDetector(),
    new RubyDetector(),
    new DartDetector(),
    new RustDetector()
  ];
  private toolchainDetector = new ToolchainDetector();
  private structureDetector = new StructureDetector();

  detect(projectPath: string, report: AnalysisReport): {
    frameworks: FrameworkInfo[];
    primaryFramework: FrameworkInfo | null;
    toolchain: DetectedToolchain;
    projectStructure: 'clean-architecture' | 'mvc' | 'modular' | 'flat' | 'monorepo' | 'unknown';
  } {
    const frameworks: FrameworkInfo[] = [];

    // Run all detectors
    for (const detector of this.detectors) {
      detector.detect(projectPath, frameworks);
    }

    // Deduplicate by name
    const seen = new Set<string>();
    const unique = frameworks.filter(f => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });

    // Sort: web frameworks first, then by confidence
    unique.sort((a, b) => {
      if (a.category === 'web' && b.category !== 'web') return -1;
      if (a.category !== 'web' && b.category === 'web') return 1;
      return b.confidence - a.confidence;
    });

    const primaryFramework = unique.find(f => f.category === 'web') || null;
    const toolchain = this.toolchainDetector.detectToolchain(projectPath, report, primaryFramework, unique);
    const projectStructure = this.structureDetector.detectProjectStructure(report);

    return { frameworks: unique, primaryFramework, toolchain, projectStructure };
  }
}
`;

writeFileSync('src/agent-generator/framework-detector.ts', facade);
console.log('Done mapping components!');
