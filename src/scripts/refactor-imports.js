import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const typeMap = {
  StackInfo: "stack.js", FrameworkInfo: "stack.js", DetectedToolchain: "stack.js",
  DomainInsights: "domain.js", BusinessEntity: "domain.js", ComplianceRequirement: "domain.js", ExternalIntegration: "domain.js", ModuleDetail: "domain.js", DetectedEndpoint: "domain.js",
  AgentAuditFinding: "agent.js", AgentItemStatus: "agent.js", AgentItem: "agent.js", AgentSuggestion: "agent.js", AgentGeneratorConfig: "agent.js", DEFAULT_AGENT_CONFIG: "agent.js",
  TemplateContext: "template.js", EnrichedTemplateContext: "template.js"
};

const files = globSync('src/**/*.ts');
let updated = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  const regex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];/g;
  const matches = [...content.matchAll(regex)];
  
  for (const m of matches) {
    if (!m[2].endsWith('types.js')) continue;
    
    // Check if the expected absolute path is src/core/agent-generator/types.js
    const baseDir = path.dirname(file);
    const absPath = path.resolve(baseDir, m[2]);
    const expected = path.resolve('src/core/agent-generator/types.js');
    if (absPath !== expected) continue;
    
    const items = m[1].split(',').map(i => i.trim()).filter(Boolean);
    const grouped = {};
    for (const item of items) {
      if (item === 'AnalysisReport' || item === 'RefactoringPlan') {
         // These were falsely imported from agent-generator/types.ts sometimes? actually wait!
         // agent-generator/types.ts didn't export AnalysisReport. They probably import it from parent.
         continue; // Wait, actually if they imported from expected, they shouldn't have AnalysisReport unless they imported it from core/types.js.
      }
      const dest = typeMap[item];
      if (!dest) {
         console.warn(`WARNING Unknown entity: ${item} in ${file}`);
         continue;
      }
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push(item);
    }
    
    // If we matched something but nothing could be placed in grouped, we continue.
    if (Object.keys(grouped).length === 0) continue;

    const newStatements = [];
    for (const dest of Object.keys(grouped)) {
      const newTarget = path.resolve('src/core/agent-generator/types', dest);
      let newRel = path.relative(baseDir, newTarget);
      if (!newRel.startsWith('.')) newRel = './' + newRel;
      newStatements.push(`import { ${grouped[dest].join(', ')} } from '${newRel}';`);
    }
    
    // Ensure we keep stuff we ignored (if it was an ad-hoc import not matching the map).
    const ignoredItems = items.filter(i => !typeMap[i]);
    if (ignoredItems.length > 0) {
      // It shouldn't be mapped here because it was an error in original file, but we preserve it just in case
      newStatements.push(`import { ${ignoredItems.join(', ')} } from '${m[2]}';`);
    }
    
    content = content.replace(m[0], newStatements.join('\n'));
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    updated++;
  }
}
console.log(`Updated ${updated} files`);
