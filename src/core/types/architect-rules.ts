export interface ArchitectRules {
  version: string;
  project?: {
    name: string;
    description?: string;
  };
  quality_gates?: {
    min_overall_score?: number;
    max_critical_anti_patterns?: number;
    max_high_anti_patterns?: number;
  };
  boundaries?: {
    allow_circular_dependencies?: boolean;
    banned_imports?: string[];
  };
}

export interface RuleViolation {
  level: 'error' | 'warning';
  rule: string;
  message: string;
  actual?: number | string | string[];
  expected?: number | string | string[];
}

export interface ValidationResult {
  success: boolean;
  violations: RuleViolation[];
}
