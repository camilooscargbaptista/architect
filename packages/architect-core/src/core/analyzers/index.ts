/**
 * Architect v4.0 Analyzers — Temporal & Predictive
 */

export { GitHistoryAnalyzer } from '../../infrastructure/git-history.js';
export type {
  GitCommit,
  FileChange,
  FileHistory,
  ModuleHistory,
  VelocityVector,
  ChangeCoupling,
  GitHistoryReport,
  WeeklySnapshot,
  GitAnalyzerConfig,
} from '../../infrastructure/git-history.js';

export { TemporalScorer } from './temporal-scorer.js';
export type {
  Trend,
  TemporalScore,
  TemporalReport,
  TemporalScorerConfig,
} from './temporal-scorer.js';

export { ForecastEngine } from './forecast.js';
export type {
  PreAntiPatternType,
  PreAntiPattern,
  ModuleForecast,
  WeatherForecast,
  ForecastConfig,
} from './forecast.js';
