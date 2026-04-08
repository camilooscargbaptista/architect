import { ArchitectureScorer } from '../src/core/scorer.js';
import {
  resolveProfile,
  mergeWeights,
  listProfileNames,
  SCORING_PROFILES,
  ScoringWeights,
} from '../src/core/scoring-profiles.js';
import type { DependencyEdge, AntiPattern } from '../src/core/types/core.js';

// ── Profile resolution tests ─────────────────────────────

describe('resolveProfile', () => {
  it('should return default profile when no info provided', () => {
    const profile = resolveProfile({});
    expect(profile.name).toBe('default');
  });

  it('should detect frontend-spa from React framework', () => {
    const profile = resolveProfile({ frameworks: ['React'] });
    expect(profile.name).toBe('frontend-spa');
  });

  it('should detect frontend-spa from Next.js', () => {
    const profile = resolveProfile({ frameworks: ['Next.js'] });
    expect(profile.name).toBe('frontend-spa');
  });

  it('should detect frontend-spa from Vue.js', () => {
    const profile = resolveProfile({ frameworks: ['Vue.js'] });
    expect(profile.name).toBe('frontend-spa');
  });

  it('should detect frontend-spa from Angular', () => {
    const profile = resolveProfile({ frameworks: ['Angular'] });
    expect(profile.name).toBe('frontend-spa');
  });

  it('should detect backend-monolith from Express.js', () => {
    const profile = resolveProfile({ frameworks: ['Express.js'] });
    expect(profile.name).toBe('backend-monolith');
  });

  it('should detect backend-monolith from NestJS', () => {
    const profile = resolveProfile({ frameworks: ['NestJS'] });
    expect(profile.name).toBe('backend-monolith');
  });

  it('should detect backend-monolith from Django', () => {
    const profile = resolveProfile({ frameworks: ['Django'] });
    expect(profile.name).toBe('backend-monolith');
  });

  it('should detect backend-monolith from Spring Boot', () => {
    const profile = resolveProfile({ frameworks: ['Spring Boot'] });
    expect(profile.name).toBe('backend-monolith');
  });

  it('should detect microservices when backend framework + monorepo', () => {
    const profile = resolveProfile({ frameworks: ['Express.js'], isMonorepo: true });
    expect(profile.name).toBe('microservices');
  });

  it('should detect microservices for Go monorepo', () => {
    const profile = resolveProfile({ languages: ['go'], isMonorepo: true });
    expect(profile.name).toBe('microservices');
  });

  it('should detect data-pipeline for Python without framework', () => {
    const profile = resolveProfile({ languages: ['python'] });
    expect(profile.name).toBe('data-pipeline');
  });

  it('should detect library from MCP SDK', () => {
    const profile = resolveProfile({ frameworks: ['MCP SDK'] });
    expect(profile.name).toBe('library');
  });

  it('should use explicit profile when provided', () => {
    const profile = resolveProfile({ explicitProfile: 'microservices', frameworks: ['React'] });
    expect(profile.name).toBe('microservices');
  });

  it('should fall back to default for unknown explicit profile', () => {
    const profile = resolveProfile({ explicitProfile: 'nonexistent' });
    expect(profile.name).toBe('default');
  });
});

// ── Weight merging tests ─────────────────────────────────

describe('mergeWeights', () => {
  it('should return profile weights when no user overrides', () => {
    const profile = SCORING_PROFILES['frontend-spa']!;
    const weights = mergeWeights(profile);
    expect(weights).toEqual(profile.weights);
  });

  it('should override individual weights', () => {
    const profile = SCORING_PROFILES['default']!;
    const weights = mergeWeights(profile, { modularity: 0.5 });
    expect(weights.modularity).toBeGreaterThan(profile.weights.modularity);
  });

  it('should normalize weights to sum to 1.0', () => {
    const profile = SCORING_PROFILES['default']!;
    const weights = mergeWeights(profile, { modularity: 0.8, coupling: 0.8 });
    const sum = weights.modularity + weights.coupling + weights.cohesion + weights.layering;
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it('should preserve exact user weights when they sum to 1.0', () => {
    const profile = SCORING_PROFILES['default']!;
    const userWeights: Partial<ScoringWeights> = {
      modularity: 0.25,
      coupling: 0.25,
      cohesion: 0.25,
      layering: 0.25,
    };
    const weights = mergeWeights(profile, userWeights);
    expect(weights.modularity).toBeCloseTo(0.25);
    expect(weights.coupling).toBeCloseTo(0.25);
  });
});

// ── Utility tests ────────────────────────────────────────

describe('listProfileNames', () => {
  it('should return all profile names', () => {
    const names = listProfileNames();
    expect(names).toContain('default');
    expect(names).toContain('frontend-spa');
    expect(names).toContain('backend-monolith');
    expect(names).toContain('microservices');
    expect(names).toContain('data-pipeline');
    expect(names).toContain('library');
  });
});

// ── Adaptive scorer behavior tests ───────────────────────

describe('ArchitectureScorer with profiles', () => {
  const edges: DependencyEdge[] = [
    { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
    { from: 'src/b.ts', to: 'src/c.ts', type: 'import', weight: 1 },
    { from: 'src/c.ts', to: 'src/d.ts', type: 'import', weight: 1 },
    { from: 'src/d.ts', to: 'src/e.ts', type: 'import', weight: 1 },
    { from: 'src/e.ts', to: 'src/a.ts', type: 'import', weight: 1 },
  ];

  const antiPatterns: AntiPattern[] = [
    { name: 'God Class', severity: 'HIGH', location: 'src/a.ts', description: 'x', suggestion: 'y' },
  ];

  it('should produce different scores for same code with different profiles', () => {
    const defaultProfile = SCORING_PROFILES['default']!;
    const frontendProfile = SCORING_PROFILES['frontend-spa']!;

    const defaultScorer = new ArchitectureScorer(defaultProfile.weights, defaultProfile.thresholds, 'default');
    const frontendScorer = new ArchitectureScorer(frontendProfile.weights, frontendProfile.thresholds, 'frontend-spa');

    const defaultScore = defaultScorer.score(edges, antiPatterns, 5);
    const frontendScore = frontendScorer.score(edges, antiPatterns, 5);

    // Scores should differ because weights are different
    expect(defaultScore.overall).not.toBe(frontendScore.overall);

    // Frontend weighs cohesion higher (0.35 vs 0.20) and coupling lower (0.15 vs 0.25)
    expect(frontendScore.components[2]!.weight).toBe(0.35); // cohesion
    expect(frontendScore.components[1]!.weight).toBe(0.15); // coupling
    expect(defaultScore.components[2]!.weight).toBe(0.20);
    expect(defaultScore.components[1]!.weight).toBe(0.25);
  });

  it('should report the active profile name', () => {
    const profile = SCORING_PROFILES['backend-monolith']!;
    const scorer = new ArchitectureScorer(profile.weights, profile.thresholds, 'backend-monolith');
    expect(scorer.getProfileName()).toBe('backend-monolith');
  });

  it('should work without any arguments (backward compat)', () => {
    const scorer = new ArchitectureScorer();
    const score = scorer.score(edges, antiPatterns, 5);
    expect(score.overall).toBeGreaterThan(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(scorer.getProfileName()).toBe('default');
  });

  it('should respect threshold differences between profiles', () => {
    const defaultProfile = SCORING_PROFILES['default']!;
    const frontendProfile = SCORING_PROFILES['frontend-spa']!;

    const defaultScorer = new ArchitectureScorer(
      defaultProfile.weights, defaultProfile.thresholds
    );
    const frontendScorer = new ArchitectureScorer(
      frontendProfile.weights, frontendProfile.thresholds
    );

    // With higher modularity threshold, frontend should score higher modularity
    // for the same edges (3 edges/file is < frontend.modularityExcellent=3 boundary vs default=2)
    const manyEdges: DependencyEdge[] = [];
    for (let i = 0; i < 25; i++) {
      manyEdges.push({
        from: `src/file${i}.ts`,
        to: `src/file${(i + 1) % 10}.ts`,
        type: 'import',
        weight: 1,
      });
    }

    const defaultMod = defaultScorer.calculateModularity(manyEdges, 10);
    const frontendMod = frontendScorer.calculateModularity(manyEdges, 10);

    // 2.5 edges/file:
    // default: < modularityGood (6) → 70+
    // frontend: < modularityExcellent (3) → 100
    // Frontend should be >= default
    expect(frontendMod).toBeGreaterThanOrEqual(defaultMod);
  });

  it('all profile weights should sum to 1.0', () => {
    for (const [, profile] of Object.entries(SCORING_PROFILES)) {
      const sum = profile.weights.modularity + profile.weights.coupling +
                  profile.weights.cohesion + profile.weights.layering;
      expect(sum).toBeCloseTo(1.0, 3);
    }
  });
});
