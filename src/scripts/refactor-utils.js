import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

// 1. html-reporter.ts
{
  const file = 'src/adapters/html-reporter.ts';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/"\.\/html-reporter\/utils\.js"/g, '"./html-reporter/utils_adapters.js"');
  fs.writeFileSync(file, content);
}

// 2. sections/*.ts
{
  const files = globSync('src/adapters/html-reporter/sections/*.ts');
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/"\.\.\/utils\.js"/g, '"../utils_sections.js"');
    fs.writeFileSync(file, content);
  }
}

console.log('Rewired utils for 9 files successfully.');
