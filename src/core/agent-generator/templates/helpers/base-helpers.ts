import { TemplateContext, EnrichedTemplateContext } from '../../types/template.js';
import { FrameworkInfo } from '../../types/stack.js';

export function getEnriched(ctx: TemplateContext): Partial<EnrichedTemplateContext> {
  if ('domain' in ctx) return ctx as EnrichedTemplateContext;
  return {};
}

export function isEnriched(ctx: TemplateContext): ctx is EnrichedTemplateContext {
  return 'domain' in ctx;
}

export function depthScale<T>(
  ctx: TemplateContext,
  options: {
    small: T;
    medium: T;
    large: T;
    enterprise: T;
  },
): T {
  const enriched = getEnriched(ctx);
  const depth = (enriched.projectDepth || 'medium') as 'small' | 'medium' | 'large' | 'enterprise';
  return options[depth];
}

export function depthAtLeast(ctx: TemplateContext, minDepth: 'small' | 'medium' | 'large' | 'enterprise'): boolean {
  const enriched = getEnriched(ctx);
  const depth = enriched.projectDepth || 'medium';
  const order = ['small', 'medium', 'large', 'enterprise'];
  return order.indexOf(depth) >= order.indexOf(minDepth);
}
