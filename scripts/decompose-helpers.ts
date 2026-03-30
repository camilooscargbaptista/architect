import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = 'src/agent-generator/templates/template-helpers.ts';
const DEST_DIR = 'src/agent-generator/templates/helpers';

if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });

const content = readFileSync(SRC, 'utf8');

const baseImports = `import { TemplateContext, EnrichedTemplateContext, FrameworkInfo } from '../../types.js';\n\n`;

// 1. Base Helpers
let baseHelpers = baseImports + `export function getEnriched(ctx: TemplateContext): Partial<EnrichedTemplateContext> {
  if ('domain' in ctx) return ctx as EnrichedTemplateContext;
  return {};
}

export function isEnriched(ctx: TemplateContext): ctx is EnrichedTemplateContext {
  return 'domain' in ctx;
}
`;
['depthScale', 'depthAtLeast'].forEach(m => {
  const r = new RegExp(`(export function ${m}[\\w\\W]*?\\n}\\n)`);
  const match = content.match(r);
  if (match) baseHelpers += '\n' + match[1];
});
// Need to replace getEnriched inside baseHelpers if it lacked an import
writeFileSync(join(DEST_DIR, 'base-helpers.ts'), baseHelpers);

// 2. Cross Ref Helpers
let crossRef = `import { TemplateContext } from '../../types.js';\n\n`;
['crossRef'].forEach(m => {
  const r = new RegExp(`(export function ${m}[\\w\\W]*?\\n}\\n)`);
  const match = content.match(r);
  if (match) crossRef += match[1] + '\n';
});
writeFileSync(join(DEST_DIR, 'cross-ref-helpers.ts'), crossRef);

// 3. Summary Helpers
let summaryHelpers = baseImports + `import { getEnriched, depthScale } from './base-helpers.js';\n\n`;
['domainBadge', 'complianceBadges', 'depthIndicator', 'modulesSummaryTable', 'integrationsSummary'].forEach(m => {
  const r = new RegExp(`(export function ${m}[\\w\\W]*?\\n}\\n)`);
  const match = content.match(r);
  if (match) summaryHelpers += match[1] + '\n';
});
writeFileSync(join(DEST_DIR, 'summary-helpers.ts'), summaryHelpers);

// 4. Stack Helpers
let stackHelpers = baseImports + `import { getEnriched } from './base-helpers.js';\n\n`;
['frameworkBadge', 'projectStructureBadge', 'toolchainCommands'].forEach(m => {
  const r = new RegExp(`(export function ${m}[\\w\\W]*?\\n}\\n)`);
  const match = content.match(r);
  if (match) stackHelpers += match[1] + '\n';
});
writeFileSync(join(DEST_DIR, 'stack-helpers.ts'), stackHelpers);

// 5. Structure Helpers
let structureHelpers = baseImports + `import { getEnriched } from './base-helpers.js';\n\n`;
['frameworkModuleStructure'].forEach(m => {
  const r = new RegExp(`(export function ${m}[\\w\\W]*?\\n}\\n)`);
  const match = content.match(r);
  if (match) structureHelpers += match[1] + '\n';
});
writeFileSync(join(DEST_DIR, 'structure-helpers.ts'), structureHelpers);

// 6. Security Helpers
let securityHelpers = baseImports + `import { getEnriched } from './base-helpers.js';\n\n`;
['frameworkSecurityChecklist'].forEach(m => {
  const r = new RegExp(`(export function ${m}[\\w\\W]*?\\n}\\n)`);
  const match = content.match(r);
  if (match) securityHelpers += match[1] + '\n';
});
writeFileSync(join(DEST_DIR, 'security-helpers.ts'), securityHelpers);

// 7. Rebuild Facade template-helpers.ts
const facade = `/**
 * Template Helpers v3.2 — Facade para todos os utilitários agnósticos e estruturais.
 *
 * Refatorado na Fase 2.3.4: Erradicação final da God Class (777 → 20 linhas).
 */

export * from './helpers/base-helpers.js';
export * from './helpers/cross-ref-helpers.js';
export * from './helpers/summary-helpers.js';
export * from './helpers/stack-helpers.js';
export * from './helpers/structure-helpers.js';
export * from './helpers/security-helpers.js';
`;
writeFileSync(SRC, facade);

console.log('FINAL God Class template-helpers.ts has been shattered into shards!');
