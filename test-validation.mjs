import { RulesEngine } from './dist/core/rules-engine.js';
import { Architect } from './dist/core/architect.js';
import { readFileSync } from 'fs';
import yaml from 'yaml';

(async () => {
  try {
    const architect = new Architect();
    const raw = readFileSync('.architect.rules.yml', 'utf8');
    const rules = yaml.parse(raw);
    const report = await architect.analyze('.'); // Github action uses `pr-review .`
    
    console.log("Analysis finished. Score:", report.score.overall);
    
    const engine = new RulesEngine();
    const res = engine.validate(report, rules);
    console.log(JSON.stringify(res, null, 2));
  } catch(e) {
    console.error(e);
  }
})();
