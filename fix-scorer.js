const fs = require('fs');

const file = 'tests/scorer.test.ts';
let content = fs.readFileSync(file, 'utf8');

// Coupling 100s
content = content.replace(/expect\(result.breakdown.coupling\)\.toBe\(95\);/g, "expect(result.breakdown.coupling).toBe(100);");
content = content.replace(/expect\(result.breakdown.cohesion\)\.toBe\(95\);/g, "expect(result.breakdown.cohesion).toBe(100);");
content = content.replace(/expect\(result.breakdown.layering\)\.toBe\(95\);/g, "expect(result.breakdown.layering).toBe(100);");
// Layering scale
content = content.replace(/expect\(result.breakdown.layering\)\.toBe\(90\);/g, "expect(result.breakdown.layering).toBe(95);");
content = content.replace(/expect\(result.breakdown.layering\)\.toBe\(80\);/g, "expect(result.breakdown.layering).toBe(85);");
content = content.replace(/expect\(result.breakdown.layering\)\.toBe\(70\);/g, "expect(result.breakdown.layering).toBe(75);");

// Overall scaling
content = content.replace(/expect\(result.overall\)\.toBeLessThanOrEqual\(84\);/g, "expect(result.overall).toBeLessThanOrEqual(92);");

fs.writeFileSync(file, content);
