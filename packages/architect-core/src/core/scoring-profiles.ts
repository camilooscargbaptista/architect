/**
 * Adaptive Scoring Profiles
 *
 * Different project archetypes have different architecture priorities.
 * A React SPA cares more about component cohesion; a Spring Boot microservice
 * cares more about coupling and layering.
 *
 * Each profile adjusts the 4 score weights (modularity, coupling, cohesion, layering)
 * AND fine-tunes thresholds within each metric to match the archetype's norms.
 *
 * @since v9.0.0 — Phase 1B (Adaptive Scoring)
 */

// ── Types ────────────────────────────────────────────────

export interface ScoringWeights {
  modularity: number;
  coupling: number;
  cohesion: number;
  layering: number;
}

export interface ScoringThresholds {
  /** Avg edges/file below which modularity is 100 */
  modularityExcellent: number;
  /** Avg edges/file below which modularity is 70+ */
  modularityGood: number;
  /** Coupling ratio below which score is 100 */
  couplingExcellent: number;
  /** Coupling ratio below which score is 70+ */
  couplingGood: number;
  /** Cohesion ratio above which score is 100 */
  cohesionExcellent: number;
  /** Cohesion ratio above which score is 70+ */
  cohesionGood: number;
  /** God class lines threshold */
  godClassLines: number;
  /** God class methods threshold */
  godClassMethods: number;
}

export interface ScoringProfile {
  name: string;
  description: string;
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
  /** Frameworks that trigger this profile */
  matchFrameworks: string[];
  /** Languages that contribute to profile matching */
  matchLanguages?: string[];
}

// ── Default thresholds (used by 'default' profile) ────────

const DEFAULT_THRESHOLDS: ScoringThresholds = {
  modularityExcellent: 2,
  modularityGood: 6,
  couplingExcellent: 0.15,
  couplingGood: 0.35,
  cohesionExcellent: 0.8,
  cohesionGood: 0.45,
  godClassLines: 500,
  godClassMethods: 10,
};

// ── Profile definitions ──────────────────────────────────

export const SCORING_PROFILES: Record<string, ScoringProfile> = {
  /**
   * Default — balanced weights, suitable for most projects.
   */
  default: {
    name: 'default',
    description: 'Balanced scoring for general-purpose projects',
    weights: { modularity: 0.40, coupling: 0.25, cohesion: 0.20, layering: 0.15 },
    thresholds: { ...DEFAULT_THRESHOLDS },
    matchFrameworks: [],
  },

  /**
   * Frontend SPA — React, Vue, Angular, Svelte.
   *
   * Frontend apps naturally have higher coupling (component trees),
   * so we de-emphasize coupling and boost cohesion (components should
   * co-locate logic, styles, tests). Layering is less meaningful in
   * component-based architectures.
   */
  'frontend-spa': {
    name: 'frontend-spa',
    description: 'Optimized for component-based frontend applications (React, Vue, Angular)',
    weights: { modularity: 0.35, coupling: 0.15, cohesion: 0.35, layering: 0.15 },
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      modularityExcellent: 3,   // SPAs have more imports per component
      modularityGood: 8,
      couplingExcellent: 0.25,  // Higher coupling is normal (component trees)
      couplingGood: 0.45,
      cohesionExcellent: 0.7,   // Components should be self-contained
      cohesionGood: 0.4,
    },
    matchFrameworks: ['React', 'Vue.js', 'Angular', 'Next.js'],
  },

  /**
   * Backend Monolith — Express, NestJS, Django, Rails, Spring Boot (non-micro).
   *
   * Monoliths need strong layering and modularity to prevent spaghetti.
   * Coupling control is critical as the codebase grows.
   */
  'backend-monolith': {
    name: 'backend-monolith',
    description: 'Optimized for monolithic backend services with layered architecture',
    weights: { modularity: 0.35, coupling: 0.30, cohesion: 0.15, layering: 0.20 },
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      modularityExcellent: 2,
      modularityGood: 5,
      couplingExcellent: 0.10,  // Monoliths should keep coupling very low
      couplingGood: 0.25,
      godClassLines: 400,       // Stricter for backend — services should be focused
      godClassMethods: 8,
    },
    matchFrameworks: ['Express.js', 'NestJS', 'Fastify', 'Django', 'Flask', 'Ruby on Rails', 'Spring Boot', 'Spring', 'Hono'],
  },

  /**
   * Microservices — small, focused services.
   *
   * Individual services are small, so coupling between files matters
   * less than coupling between services (not measured by file deps).
   * Modularity and layering within each service are key.
   */
  microservices: {
    name: 'microservices',
    description: 'Optimized for small, focused microservices',
    weights: { modularity: 0.30, coupling: 0.20, cohesion: 0.25, layering: 0.25 },
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      modularityExcellent: 3,
      modularityGood: 7,
      couplingExcellent: 0.20,
      couplingGood: 0.40,
      godClassLines: 300,        // Services should be small
      godClassMethods: 6,
    },
    matchFrameworks: [],  // Detected via workspace analysis, not framework
    matchLanguages: ['go'],
  },

  /**
   * Data Pipeline — ETL, ML, data science projects.
   *
   * These projects have linear flows (extract → transform → load),
   * so coupling direction matters more than amount. Cohesion of pipeline
   * stages is the primary concern. Layering is less relevant.
   */
  'data-pipeline': {
    name: 'data-pipeline',
    description: 'Optimized for ETL, ML, and data processing pipelines',
    weights: { modularity: 0.30, coupling: 0.25, cohesion: 0.35, layering: 0.10 },
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      modularityExcellent: 4,   // Pipelines have more shared utilities
      modularityGood: 8,
      cohesionExcellent: 0.65,
      cohesionGood: 0.35,
      godClassLines: 600,        // Notebooks and scripts can be longer
      godClassMethods: 15,
    },
    matchFrameworks: ['FastAPI'],
    matchLanguages: ['python'],
  },

  /**
   * Library / SDK — reusable packages.
   *
   * Libraries must have very clean public APIs, so modularity is king.
   * Internal coupling is acceptable if exports are clean.
   */
  library: {
    name: 'library',
    description: 'Optimized for reusable libraries and SDKs',
    weights: { modularity: 0.45, coupling: 0.20, cohesion: 0.25, layering: 0.10 },
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      modularityExcellent: 2,
      modularityGood: 5,
      couplingExcellent: 0.20,
      couplingGood: 0.40,
      godClassLines: 400,
      godClassMethods: 12,
    },
    matchFrameworks: ['MCP SDK'],
  },
};

// ── Profile resolution ───────────────────────────────────

/**
 * Resolve the best scoring profile for a project based on detected
 * frameworks, languages, and user preferences.
 *
 * Priority:
 *   1. Explicit profile name from config (user override)
 *   2. Auto-detection from frameworks
 *   3. Auto-detection from primary languages
 *   4. Fallback to 'default'
 */
export function resolveProfile(options: {
  explicitProfile?: string;
  frameworks?: string[];
  languages?: string[];
  isMonorepo?: boolean;
}): ScoringProfile {
  const { explicitProfile, frameworks = [], languages = [], isMonorepo } = options;

  // 1. Explicit user override
  if (explicitProfile && SCORING_PROFILES[explicitProfile]) {
    return SCORING_PROFILES[explicitProfile]!;
  }

  // Explicit profile name not found — treat as custom? No, fall through.

  // 2. Framework-based detection
  const frameworksLower = frameworks.map(f => f.toLowerCase());

  // Check frontend first (most common)
  const frontendProfile = SCORING_PROFILES['frontend-spa']!;
  if (frontendProfile.matchFrameworks.some(f => frameworksLower.includes(f.toLowerCase()))) {
    return frontendProfile;
  }

  // Check backend monolith
  const backendProfile = SCORING_PROFILES['backend-monolith']!;
  if (backendProfile.matchFrameworks.some(f => frameworksLower.includes(f.toLowerCase()))) {
    // If monorepo with many packages, likely microservices
    if (isMonorepo) {
      return SCORING_PROFILES['microservices']!;
    }
    return backendProfile;
  }

  // Check library
  const libraryProfile = SCORING_PROFILES['library']!;
  if (libraryProfile.matchFrameworks.some(f => frameworksLower.includes(f.toLowerCase()))) {
    return libraryProfile;
  }

  // 3. Language-based heuristics
  const languagesLower = languages.map(l => l.toLowerCase());

  if (languagesLower.includes('go') && isMonorepo) {
    return SCORING_PROFILES['microservices']!;
  }

  if (languagesLower.includes('python') && !frameworks.length) {
    // Python without web framework → likely data pipeline
    return SCORING_PROFILES['data-pipeline']!;
  }

  // 4. Default
  return SCORING_PROFILES['default']!;
}

/**
 * Merge user-provided weight overrides with a resolved profile.
 * User values in `.architect.json` `score` field always win.
 */
export function mergeWeights(
  profile: ScoringProfile,
  userWeights?: Partial<ScoringWeights>,
): ScoringWeights {
  if (!userWeights) return { ...profile.weights };

  const merged = { ...profile.weights };
  if (userWeights.modularity !== undefined) merged.modularity = userWeights.modularity;
  if (userWeights.coupling !== undefined) merged.coupling = userWeights.coupling;
  if (userWeights.cohesion !== undefined) merged.cohesion = userWeights.cohesion;
  if (userWeights.layering !== undefined) merged.layering = userWeights.layering;

  // Normalize to sum to 1.0
  const sum = merged.modularity + merged.coupling + merged.cohesion + merged.layering;
  if (sum > 0 && Math.abs(sum - 1.0) > 0.001) {
    merged.modularity /= sum;
    merged.coupling /= sum;
    merged.cohesion /= sum;
    merged.layering /= sum;
  }

  return merged;
}

/**
 * List all available profile names for CLI help/autocomplete.
 */
export function listProfileNames(): string[] {
  return Object.keys(SCORING_PROFILES);
}
