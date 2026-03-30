import { architect } from './dist/core/architect.js';
(async () => {
  const report = await architect.analyze('.');
  const patterns = report.antiPatterns.filter(p => p.name === 'Shotgun Surgery');
  patterns.forEach(p => console.log(p.location));
})();
