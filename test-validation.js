const { RulesEngine } = require('./dist/core/rules-engine.js');
const { Architect } = require('./dist/core/architect.js');
const { readFileSync } = require('fs');
const yaml = require('yaml');

(async () => {
  const architect = new Architect();
  const raw = readFileSync('.architect.rules.yml', 'utf8');
  const rules = yaml.parse(raw);
  const report = await architect.analyze('./src');
  
  const engine = new RulesEngine();
  const res = engine.validate(report, rules);
  console.log(JSON.stringify(res, null, 2));
})();
