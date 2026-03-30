import { AnalysisReport } from '../types.js';
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
