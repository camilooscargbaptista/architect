/**
 * Requirements Parser
 *
 * Extracts structured requirements from natural language documents.
 * Uses pattern matching and NLP heuristics to identify:
 * - Bounded contexts / feature areas
 * - Entities and relationships
 * - Integration points
 * - Non-functional requirements
 * - Workflows and actors
 *
 * @since v10.0.0 — Phase 4.1
 */

import type {
  RequirementsDocument,
  ParsedRequirements,
  BoundedContext,
  Entity,
  EntityField,
  EntityRelationship,
  Integration,
  NonFunctionalRequirements,
  Workflow,
} from './types.js';

// ── Keyword dictionaries ──────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'e-commerce': ['cart', 'checkout', 'payment', 'product', 'catalog', 'order', 'shipping', 'inventory', 'price', 'discount', 'coupon'],
  'fintech': ['transaction', 'account', 'balance', 'transfer', 'payment', 'ledger', 'wallet', 'kyc', 'compliance', 'bank'],
  'healthcare': ['patient', 'appointment', 'prescription', 'diagnosis', 'medical', 'health', 'doctor', 'hospital', 'clinical'],
  'saas': ['tenant', 'subscription', 'billing', 'plan', 'feature', 'onboarding', 'workspace', 'organization'],
  'social': ['post', 'feed', 'follow', 'comment', 'like', 'notification', 'profile', 'message', 'friend'],
  'education': ['course', 'student', 'lesson', 'quiz', 'enrollment', 'grade', 'instructor', 'curriculum'],
  'logistics': ['shipment', 'tracking', 'warehouse', 'delivery', 'route', 'fleet', 'driver', 'cargo'],
  'crm': ['contact', 'lead', 'pipeline', 'deal', 'opportunity', 'campaign', 'customer', 'sales'],
};

const INTEGRATION_PATTERNS: Array<{ pattern: RegExp; type: Integration['type'] }> = [
  { pattern: /\b(rest\s*api|http\s*endpoint|api\s*endpoint|restful)\b/i, type: 'rest-api' },
  { pattern: /\bgraphql\b/i, type: 'graphql' },
  { pattern: /\bgrpc\b/i, type: 'grpc' },
  { pattern: /\b(postgres|mysql|mongodb|sqlite|redis|database|db)\b/i, type: 'database' },
  { pattern: /\b(kafka|rabbitmq|sqs|queue|pubsub|event\s*bus)\b/i, type: 'queue' },
  { pattern: /\b(websocket|ws|real.?time|socket)\b/i, type: 'websocket' },
  { pattern: /\b(stripe|twilio|sendgrid|aws|gcp|azure|firebase|third.?party|external)\b/i, type: 'external-service' },
];

const AUTH_PATTERNS = /\b(jwt|oauth|oauth2|session|token|api.?key|bearer|saml|sso|openid|auth0|cognito|firebase\s*auth)\b/i;
const DB_PATTERNS = /\b(postgres(?:ql)?|mysql|mariadb|mongodb|mongo|sqlite|redis|dynamodb|cassandra|cockroachdb|supabase|prisma|typeorm|drizzle|sequelize|mongoose)\b/i;
const STACK_PATTERNS = /\b(typescript|javascript|python|go|golang|java|rust|ruby|php|c#|\.net|kotlin|swift|elixir)\b/i;
const FRAMEWORK_PATTERNS = /\b(express|nestjs|fastify|koa|hono|next\.?js|nuxt|django|flask|fastapi|spring|gin|fiber|actix|rails|laravel|phoenix)\b/i;

const ENTITY_INDICATORS = /\b(entity|model|table|schema|resource|object|record|document|type|class|struct)\b/i;
const FIELD_TYPE_MAP: Record<string, string> = {
  'id': 'string', 'uuid': 'string', 'name': 'string', 'title': 'string',
  'email': 'string', 'url': 'string', 'description': 'string', 'content': 'string',
  'password': 'string', 'token': 'string', 'slug': 'string', 'phone': 'string',
  'price': 'number', 'amount': 'number', 'quantity': 'number', 'total': 'number',
  'count': 'number', 'balance': 'number', 'score': 'number', 'rating': 'number',
  'age': 'number', 'weight': 'number', 'height': 'number', 'size': 'number',
  'active': 'boolean', 'enabled': 'boolean', 'verified': 'boolean', 'published': 'boolean',
  'deleted': 'boolean', 'admin': 'boolean', 'public': 'boolean',
  'date': 'Date', 'timestamp': 'Date', 'created': 'Date', 'updated': 'Date',
  'expired': 'Date', 'birthday': 'Date', 'deadline': 'Date',
};

const ACTOR_PATTERNS = /\b(user|admin|customer|client|manager|operator|viewer|editor|moderator|owner|member|guest|subscriber|agent|analyst|developer|support|staff)\b/gi;

// ── Parser ────────────────────────────────────────────────

export class RequirementsParser {
  /**
   * Parse a requirements document into structured requirements.
   */
  parse(doc: RequirementsDocument): ParsedRequirements {
    const text = doc.rawText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const projectName = this.extractProjectName(text, lines);
    const description = this.extractDescription(text, lines);
    const domain = this.detectDomain(text);
    const entities = this.extractEntities(text, lines);
    const boundedContexts = this.extractBoundedContexts(text, lines, entities);
    const integrations = this.extractIntegrations(text);
    const nonFunctional = this.extractNonFunctional(text);
    const actors = this.extractActors(text);
    const workflows = this.extractWorkflows(text, lines, actors);
    const constraints = this.extractConstraints(text, lines);

    return {
      projectName,
      description,
      domain,
      boundedContexts,
      entities,
      integrations,
      nonFunctional,
      constraints,
      actors,
      workflows,
    };
  }

  // ── Project name ────────────────────────────────────────

  private extractProjectName(text: string, lines: string[]): string {
    // Check for markdown H1
    const h1 = lines.find(l => /^#\s+/.test(l));
    if (h1) return h1.replace(/^#+\s+/, '').trim();

    // Check for "Project: X" or "Name: X"
    const nameMatch = text.match(/(?:project|name|title)\s*[:\-]\s*(.+)/i);
    if (nameMatch) return nameMatch[1]!.trim();

    // First non-empty line as fallback
    return lines[0] ?? 'untitled-project';
  }

  // ── Description ─────────────────────────────────────────

  private extractDescription(text: string, lines: string[]): string {
    // Look for explicit description section
    const descMatch = text.match(/(?:description|overview|summary|about)\s*[:\-]\s*(.+?)(?:\n\n|\n#)/is);
    if (descMatch) return descMatch[1]!.trim().split('\n')[0]!.trim();

    // First paragraph after H1
    const h1Idx = lines.findIndex(l => /^#\s+/.test(l));
    if (h1Idx >= 0 && h1Idx + 1 < lines.length) {
      const nextNonEmpty = lines.slice(h1Idx + 1).find(l => l.length > 0 && !l.startsWith('#'));
      if (nextNonEmpty) return nextNonEmpty;
    }

    return lines.slice(0, 2).join(' ');
  }

  // ── Domain detection ────────────────────────────────────

  detectDomain(text: string): string {
    const lower = text.toLowerCase();
    let bestDomain = 'general';
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const score = keywords.filter(kw => lower.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    return bestDomain;
  }

  // ── Entity extraction ───────────────────────────────────

  extractEntities(text: string, lines: string[]): Entity[] {
    const entities: Entity[] = [];
    const seen = new Set<string>();

    // Strategy 1: Look for explicit entity definitions (markdown headers + fields)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // "### User Entity" or "## Entity: User" or "- **User**: ..."
      const entityMatch = line.match(/(?:^#{1,4}\s+)?(?:entity|model|schema|type|table)?[:\s]*\*{0,2}(\w+)\*{0,2}\s*(?:entity|model|schema)?/i);
      if (!entityMatch) continue;
      if (!ENTITY_INDICATORS.test(line) && !this.looksLikeEntityHeader(line)) continue;

      const name = this.toPascalCase(entityMatch[1]!);
      if (seen.has(name) || name.length < 2) continue;

      // Collect fields from subsequent lines
      const fields: EntityField[] = [];
      const relationships: EntityRelationship[] = [];

      for (let j = i + 1; j < lines.length && j < i + 30; j++) {
        const fieldLine = lines[j]!;
        if (/^#{1,4}\s+/.test(fieldLine)) break; // Next header

        const fieldMatch = fieldLine.match(/[-*]\s+\*{0,2}(\w+)\*{0,2}\s*[:\-]\s*(.+)/);
        if (!fieldMatch) continue;

        const fieldName = fieldMatch[1]!.toLowerCase();
        const fieldDesc = fieldMatch[2]!.trim();

        // Check if this is a relationship
        const relMatch = fieldDesc.match(/(?:has\s+many|belongs\s+to|has\s+one|many\s+to\s+many|references?|foreign\s+key)\s+(\w+)/i);
        if (relMatch) {
          const relType = fieldDesc.toLowerCase().includes('many-to-many') ? 'many-to-many'
            : fieldDesc.toLowerCase().includes('has many') ? 'one-to-many'
            : 'one-to-one';
          relationships.push({
            target: this.toPascalCase(relMatch[1]!),
            type: relType,
            description: fieldDesc,
          });
        }

        fields.push({
          name: this.toCamelCase(fieldName),
          type: this.inferFieldType(fieldName, fieldDesc),
          required: !fieldDesc.toLowerCase().includes('optional'),
          description: fieldDesc,
        });
      }

      if (fields.length > 0 || relationships.length > 0) {
        seen.add(name);
        entities.push({ name, fields, relationships });
      }
    }

    // Strategy 1.5: Inline entity definitions — "Task: title, description, dueDate"
    // Also handles "- Product entity: name, price, ..." bullet format
    for (const line of lines) {
      const inlineMatch = line.match(/^(?:[-*]\s+)?(\w+)\s+(?:entity|model|table)[:\s]+(.+)/i)
        ?? line.match(/^([A-Z][a-zA-Z]+)\s*:\s*(.+)/);
      if (!inlineMatch) continue;

      const name = this.toPascalCase(inlineMatch[1]!);
      if (seen.has(name) || name.length < 2) continue;

      const fieldList = inlineMatch[2]!;
      const fieldNames = fieldList.split(/,\s*/);
      if (fieldNames.length < 2) continue; // Needs at least 2 fields to look like an entity

      const fields: EntityField[] = fieldNames.map(raw => {
        const typeMatch = raw.match(/(\w+)\s*\((\w+)\)/);
        if (typeMatch) {
          return {
            name: this.toCamelCase(typeMatch[1]!),
            type: this.inferFieldType(typeMatch[1]!, typeMatch[2]!),
            required: true,
          };
        }
        const cleaned = raw.trim().replace(/[^a-zA-Z]/g, '');
        return {
          name: this.toCamelCase(cleaned),
          type: this.inferFieldType(cleaned, raw),
          required: true,
        };
      });

      seen.add(name);
      entities.push({ name, fields, relationships: [] });
    }

    // Strategy 2: Infer entities from repeated capitalized nouns
    const nounPattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/g;
    const nounCounts = new Map<string, number>();
    let match: RegExpExecArray | null;

    while ((match = nounPattern.exec(text)) !== null) {
      const noun = match[1]!;
      if (noun.length < 3 || seen.has(noun)) continue;
      if (['The', 'This', 'That', 'When', 'Each', 'Every', 'Some', 'API', 'REST', 'HTTP', 'JWT', 'SQL'].includes(noun)) continue;
      nounCounts.set(noun, (nounCounts.get(noun) ?? 0) + 1);
    }

    for (const [noun, count] of nounCounts) {
      if (count >= 3 && !seen.has(noun)) {
        seen.add(noun);
        entities.push({
          name: noun,
          fields: this.inferCommonFields(noun),
          relationships: [],
        });
      }
    }

    return entities;
  }

  // ── Bounded contexts ────────────────────────────────────

  extractBoundedContexts(text: string, lines: string[], entities: Entity[]): BoundedContext[] {
    const contexts: BoundedContext[] = [];
    const seen = new Set<string>();

    // Strategy 1: Explicit sections (## Module: Auth, ## Feature: Payments)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const sectionMatch = line.match(/^#{1,3}\s+(?:module|feature|context|service|domain|area)[:\s]+(.+)/i);
      if (!sectionMatch) continue;

      const name = this.toKebabCase(sectionMatch[1]!.trim());
      if (seen.has(name)) continue;
      seen.add(name);

      // Collect description from following lines
      const descLines: string[] = [];
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (/^#{1,3}\s+/.test(lines[j]!)) break;
        if (lines[j]!.length > 0) descLines.push(lines[j]!);
      }

      const relatedEntities = entities
        .filter(e => descLines.some(d => d.includes(e.name)) || text.toLowerCase().includes(`${name} ${e.name.toLowerCase()}`))
        .map(e => e.name);

      contexts.push({
        name,
        description: descLines.join(' ').slice(0, 200),
        entities: relatedEntities,
        responsibility: descLines[0] ?? `Manages ${name} domain logic`,
      });
    }

    // Strategy 2: Infer from entity clusters if no explicit contexts
    if (contexts.length === 0 && entities.length > 0) {
      const groups = this.clusterEntities(entities, text);
      for (const [groupName, groupEntities] of Object.entries(groups)) {
        if (seen.has(groupName)) continue;
        seen.add(groupName);
        contexts.push({
          name: groupName,
          description: `Manages ${groupEntities.join(', ')}`,
          entities: groupEntities,
          responsibility: `${groupName} domain operations`,
        });
      }
    }

    return contexts;
  }

  // ── Integrations ────────────────────────────────────────

  extractIntegrations(text: string): Integration[] {
    const integrations: Integration[] = [];
    const seen = new Set<string>();

    for (const { pattern, type } of INTEGRATION_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern, 'gi'));
      for (const m of matches) {
        const name = m[0]!.trim().toLowerCase();
        if (seen.has(name)) continue;
        seen.add(name);

        // Get surrounding context for description
        const idx = m.index ?? 0;
        const start = Math.max(0, text.lastIndexOf('\n', idx));
        const end = text.indexOf('\n', idx + name.length);
        const context = text.slice(start, end > 0 ? end : idx + 100).trim();

        integrations.push({ name, type, description: context.slice(0, 150) });
      }
    }

    return integrations;
  }

  // ── Non-functional requirements ─────────────────────────

  extractNonFunctional(text: string): NonFunctionalRequirements {
    const authMatch = text.match(AUTH_PATTERNS);
    const dbMatch = text.match(DB_PATTERNS);
    const stackMatch = text.match(STACK_PATTERNS);

    const security: string[] = [];
    if (/\b(https|ssl|tls|encryption)\b/i.test(text)) security.push('TLS/HTTPS required');
    if (/\b(rbac|role.?based|permission)\b/i.test(text)) security.push('RBAC');
    if (/\b(rate.?limit|throttl)/i.test(text)) security.push('Rate limiting');
    if (/\b(input.?validation|sanitiz)/i.test(text)) security.push('Input validation');

    const compliance: string[] = [];
    if (/\bgdpr\b/i.test(text)) compliance.push('GDPR');
    if (/\bhipaa\b/i.test(text)) compliance.push('HIPAA');
    if (/\bpci[\s-]?dss\b/i.test(text)) compliance.push('PCI-DSS');
    if (/\bsoc[\s-]?2\b/i.test(text)) compliance.push('SOC 2');

    const scalability = text.match(/\b(horizontal|vertical|auto.?scal|load.?balanc|cluster|replica)/i)?.[0];
    const performance = text.match(/\b(\d+\s*ms|\d+\s*rps|low.?latency|real.?time|sub.?second)/i)?.[0];

    return {
      ...(stackMatch?.[0] ? { preferredStack: stackMatch[0] } : {}),
      ...(authMatch?.[0] ? { auth: authMatch[0] } : {}),
      ...(dbMatch?.[0] ? { database: dbMatch[0] } : {}),
      ...(scalability ? { scalability } : {}),
      ...(performance ? { performance } : {}),
      security,
      compliance,
    };
  }

  // ── Actors ──────────────────────────────────────────────

  extractActors(text: string): string[] {
    const actors = new Set<string>();
    let actorMatch: RegExpExecArray | null;
    const pat = new RegExp(ACTOR_PATTERNS.source, 'gi');

    while ((actorMatch = pat.exec(text)) !== null) {
      actors.add(actorMatch[1]!.toLowerCase());
    }

    return Array.from(actors);
  }

  // ── Workflows ───────────────────────────────────────────

  extractWorkflows(_text: string, lines: string[], actors: string[]): Workflow[] {
    const workflows: Workflow[] = [];

    // Look for numbered step lists or "Flow:" sections
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const flowMatch = line.match(/(?:^#{1,4}\s+)?(?:flow|workflow|process|use.?case|scenario|user.?story)[:\s]+(.+)/i);
      if (!flowMatch) continue;

      const name = flowMatch[1]!.trim();
      const steps: string[] = [];
      const desc: string[] = [];

      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        const step = lines[j]!;
        if (/^#{1,4}\s+/.test(step)) break;

        const stepMatch = step.match(/^\d+[.)]\s+(.+)/) || step.match(/^[-*]\s+(.+)/);
        if (stepMatch) {
          steps.push(stepMatch[1]!.trim());
        } else if (step.length > 0 && steps.length === 0) {
          desc.push(step);
        }
      }

      const workflowActors = actors.filter(a =>
        steps.some(s => s.toLowerCase().includes(a)) ||
        desc.some(d => d.toLowerCase().includes(a))
      );

      workflows.push({
        name,
        description: desc.join(' ').slice(0, 200) || `${name} workflow`,
        steps,
        actors: workflowActors.length > 0 ? workflowActors : ['user'],
      });
    }

    return workflows;
  }

  // ── Constraints ─────────────────────────────────────────

  private extractConstraints(text: string, lines: string[]): string[] {
    const constraints: string[] = [];

    for (const line of lines) {
      if (/(?:constraint|limitation|restriction|must\s+not|forbidden|prohibited|required)\b/i.test(line)) {
        constraints.push(line.replace(/^[-*#\d.)\s]+/, '').trim());
      }
    }

    // Technical constraints
    const frameworkMatch = text.match(FRAMEWORK_PATTERNS);
    if (frameworkMatch) constraints.push(`Framework: ${frameworkMatch[0]}`);

    return constraints;
  }

  // ── Helpers ─────────────────────────────────────────────

  private looksLikeEntityHeader(line: string): boolean {
    return /\b(User|Account|Product|Order|Payment|Session|Post|Comment|Message|Event|Task|Project|Team|Organization|Invoice|Subscription|Notification|Category|Tag|File|Image|Setting|Role|Permission)\b/.test(line);
  }

  private inferFieldType(fieldName: string, description: string): string {
    const lower = fieldName.toLowerCase();

    // Exact match
    if (FIELD_TYPE_MAP[lower]) return FIELD_TYPE_MAP[lower]!;

    // Suffix match
    if (lower.endsWith('_id') || lower.endsWith('id')) return 'string';
    if (lower.endsWith('_at') || lower.endsWith('date')) return 'Date';
    if (lower.endsWith('_count') || lower.endsWith('amount')) return 'number';
    if (lower.startsWith('is_') || lower.startsWith('has_')) return 'boolean';

    // Description-based
    if (/\bnumber|integer|float|decimal\b/i.test(description)) return 'number';
    if (/\bboolean|flag|toggle\b/i.test(description)) return 'boolean';
    if (/\bdate|time|timestamp\b/i.test(description)) return 'Date';
    if (/\barray|list\b/i.test(description)) return 'string[]';

    return 'string';
  }

  private inferCommonFields(entityName: string): EntityField[] {
    const common: EntityField[] = [
      { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
      { name: 'createdAt', type: 'Date', required: true, description: 'Creation timestamp' },
      { name: 'updatedAt', type: 'Date', required: true, description: 'Last update timestamp' },
    ];

    // Add name field for most entities
    if (!['Event', 'Transaction', 'Log', 'Session'].includes(entityName)) {
      common.splice(1, 0, { name: 'name', type: 'string', required: true, description: `${entityName} name` });
    }

    return common;
  }

  private clusterEntities(entities: Entity[], text: string): Record<string, string[]> {
    const groups: Record<string, string[]> = {};

    // Simple clustering: group entities by co-occurrence in same paragraph
    const paragraphs = text.split(/\n\n+/);
    const assigned = new Set<string>();

    for (const para of paragraphs) {
      const found = entities.filter(e => para.includes(e.name));
      if (found.length >= 2) {
        // Determine group name from first entity or context
        const groupName = this.toKebabCase(found[0]!.name);
        if (!groups[groupName]) groups[groupName] = [];
        for (const e of found) {
          if (!assigned.has(e.name)) {
            groups[groupName]!.push(e.name);
            assigned.add(e.name);
          }
        }
      }
    }

    // Assign remaining entities to their own context
    for (const e of entities) {
      if (!assigned.has(e.name)) {
        const ctx = this.toKebabCase(e.name);
        groups[ctx] = [e.name];
      }
    }

    return groups;
  }

  private toPascalCase(s: string): string {
    return s.replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toUpperCase());
  }

  private toCamelCase(s: string): string {
    const pascal = this.toPascalCase(s);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toKebabCase(s: string): string {
    return s
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}
