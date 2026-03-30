import { AnalysisReport, RefactoringPlan } from '../../types.js';
import { StackInfo, EnrichedTemplateContext, DEFAULT_AGENT_CONFIG } from '../types.js';
import { ContextEnricher } from '../context-enricher.js';

export class ContextBuilder {
  private contextEnricher = new ContextEnricher();
  
  public static readonly MAX_FILE_LINES = 500;
  public static readonly EXCLUDED_SEGMENTS = [
    'node_modules', '/dist/', '/build/', '/coverage/',
    '/.next/', '/venv/', '/__pycache__/', '/target/',
  ];

  public sanitizeReport(report: AnalysisReport): AnalysisReport {
    const isProjectPath = (path: string): boolean => {
      const normalized = path.replace(/\\/g, '/');
      return !ContextBuilder.EXCLUDED_SEGMENTS.some(seg => normalized.includes(seg));
    };

    return {
      ...report,
      antiPatterns: report.antiPatterns.filter(ap => {
        if (!isProjectPath(ap.location)) return false;
        if (ap.affectedFiles?.some(f => !isProjectPath(f))) {
          ap.affectedFiles = ap.affectedFiles.filter(f => isProjectPath(f));
        }
        return true;
      }),
      dependencyGraph: {
        nodes: report.dependencyGraph.nodes.filter(n => isProjectPath(n)),
        edges: report.dependencyGraph.edges.filter(
          e => isProjectPath(e.from) && isProjectPath(e.to)
        ),
      },
      suggestions: report.suggestions.filter(
        s => !s.description.includes('node_modules')
      ),
    };
  }

  public capContent(content: string): string {
    const lines = content.split('\n');
    if (lines.length <= ContextBuilder.MAX_FILE_LINES) return content;

    const truncated = lines.slice(0, ContextBuilder.MAX_FILE_LINES);
    truncated.push('');
    truncated.push('<!-- Content truncated at ' + ContextBuilder.MAX_FILE_LINES + ' lines. Run `architect agents` to regenerate. -->');
    return truncated.join('\n');
  }

  public buildContext(report: AnalysisReport, plan: RefactoringPlan, stack: StackInfo, projectPath?: string): EnrichedTemplateContext {
    if (projectPath) {
      return this.contextEnricher.enrich(report, plan, stack, projectPath);
    }
    // Fallback to basic enriched context for backward compatibility
    return {
      report,
      plan,
      stack,
      projectName: report.projectInfo.name || 'Project',
      stackLabel: [...stack.languages, ...stack.frameworks].join(' + '),
      config: DEFAULT_AGENT_CONFIG,
      domain: {
        domain: 'general',
        subDomain: 'general',
        description: '',
        businessEntities: [],
        compliance: [],
        integrations: [],
        keywords: [],
        confidence: 0,
      },
      modules: [],
      endpoints: [],
      untestedModules: [],
      criticalPaths: [],
      projectDepth: 'small',
      detectedFrameworks: [],
      primaryFramework: null,
      toolchain: {
        buildCmd: 'echo "No build command detected"',
        testCmd: 'echo "No test command detected"',
        lintCmd: 'echo "No lint command detected"',
        runCmd: 'echo "No run command detected"',
        coverageCmd: 'echo "No coverage command detected"',
        installCmd: 'echo "No install command detected"',
        migrateCmd: null,
        depsFile: 'unknown',
      },
      projectStructure: 'unknown',
    };
  }
}
