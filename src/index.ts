export { Architect, architect } from './core/architect.js';
export type { ProgressPhase, ProgressEvent, ProgressCallback, ArchitectCommand } from './core/architect.js';

export { ProjectScanner } from './infrastructure/scanner.js';
export { ArchitectureAnalyzer } from './core/analyzer.js';
export { AntiPatternDetector } from './core/anti-patterns.js';
export { ArchitectureScorer } from './core/scorer.js';
export { DiagramGenerator } from './core/diagram.js';
export { ReportGenerator } from './adapters/reporter.js';
export { HtmlReportGenerator } from './adapters/html-reporter.js';
export { AgentGenerator } from './core/agent-generator/index.js';
export { ConfigLoader } from './core/config.js';

// ── v4.0: Temporal & Predictive Analyzers ──
export { GitHistoryAnalyzer, TemporalScorer, ForecastEngine } from './core/analyzers/index.js';
export { saveToCache, loadFromCache } from './infrastructure/git-cache.js';
export type {
  GitHistoryReport, FileHistory, ModuleHistory, VelocityVector,
  ChangeCoupling, GitAnalyzerConfig,
} from './infrastructure/git-history.js';
export type {
  Trend, TemporalScore, TemporalReport, TemporalScorerConfig,
} from './core/analyzers/temporal-scorer.js';
export type {
  PreAntiPatternType, PreAntiPattern, ModuleForecast,
  WeatherForecast, ForecastConfig,
} from './core/analyzers/forecast.js';
