import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const RESULTS_DIR = resolve('./benchmarks');
const AGGREGATE_FILE = resolve(RESULTS_DIR, 'aggregate.json');
const MD_OUTPUT = resolve('./BENCHMARK.md');

function run() {
  console.log('📊 Generatin Benchmark Report...');
  
  let raw: string;
  try {
    raw = readFileSync(AGGREGATE_FILE, 'utf8');
  } catch (e) {
    console.error(`❌ Could not find ${AGGREGATE_FILE}. Run benchmark-runner first.`);
    return;
  }

  const results = JSON.parse(raw);

  let md = `# Architect Scanner Benchmark Report\n\n`;
  md += `This document contains the official scoring calibration against leading Open-Source projects.\n`;
  md += `The goal is to maintain False Positives (FP) < 5% and keep robust projects between 70-90 score.\n\n`;

  md += `## 🏆 Results Overview\n\n`;
  md += `| Project | Overall Score | Anti-patterns | Files Scanned | Lines Analyzed |\n`;
  md += `|---------|---------------|---------------|---------------|----------------|\n`;

  for (const { name, report: rawReport } of results) {
    const reportData = rawReport.report || rawReport; // fallback just in case
    const score = reportData.score?.overall || 0;
    const apCount = reportData.antiPatterns?.length || 0;
    const files = reportData.projectInfo?.totalFiles || 0;
    const lines = reportData.projectInfo?.totalLines || 0;
    
    md += `| **${name}** | **${score}/100** | ${apCount} | ${files} | ${lines.toLocaleString()} |\n`;
  }

  md += `\n## 🔍 Deep Dive by Project\n\n`;

  for (const { name, report: rawReport } of results) {
    const reportData = rawReport.report || rawReport;
    md += `### ${name.toUpperCase()} (Score: ${reportData.score?.overall || 0}/100)\n\n`;
    
    // Group APs
    const aps = reportData.antiPatterns || [];
    if (aps.length === 0) {
      md += `*✅ No anti-patterns detected.*\n\n`;
    } else {
      md += `**Top Anti-Patterns Detected:**\n`;
      const grouped = aps.reduce((acc: any, curr: any) => {
        acc[curr.name] = (acc[curr.name] || 0) + 1;
        return acc;
      }, {});
      
      for (const [apName, count] of Object.entries(grouped)) {
        md += `- **${apName}**: ${count} occurrences\n`;
      }
      md += `\n`;
    }
  }

  md += `\n## 🛠️ Calibration Notes\n`;
  md += `> If large OSS projects like *NestJS* or *Express* are dropping below 70, the \`RulesEngine\` is too aggressive. `;
  md += `Metrics like *God Class* or *Circular Dependencies* need to recognize inversion of control or large utility files (like express router) gracefully without heavily penalizing the overall score.\n`;

  writeFileSync(MD_OUTPUT, md, 'utf8');
  console.log(`✅ Report generated at ${MD_OUTPUT}`);
}

run();
