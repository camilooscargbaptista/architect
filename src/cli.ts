#!/usr/bin/env node

/**
 * Architect CLI
 * Executa análise arquitetural e gera relatórios em múltiplos formatos
 *
 * Uso:
 *   npx architect analyze ./src
 *   npx architect analyze ./src --format html --output report.html
 *   npx architect diagram ./src
 *   npx architect score ./src
 *   npx architect anti-patterns ./src
 *   npx architect layers ./src
 */

import { architect } from './index.js';
import { ReportGenerator } from './reporter.js';
import { HtmlReportGenerator } from './html-reporter.js';
import { writeFileSync } from 'fs';
import { resolve, basename } from 'path';

type OutputFormat = 'json' | 'markdown' | 'html';

interface CliOptions {
  command: string;
  path: string;
  format: OutputFormat;
  output?: string;
}

function parseArgs(args: string[]): CliOptions {
  const command = args[0] || 'analyze';
  const pathArg = args.find((a) => !a.startsWith('--') && a !== command) || '.';
  const formatIdx = args.indexOf('--format');
  const format = (formatIdx >= 0 ? args[formatIdx + 1] : 'html') as OutputFormat;
  const outputIdx = args.indexOf('--output');
  const output = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

  return { command, path: resolve(pathArg), format, output };
}

function printUsage(): void {
  console.log(`
🏗️  Architect — AI-powered architecture analysis

Usage:
  architect <command> [path] [options]

Commands:
  analyze         Full architecture analysis (default)
  diagram         Generate architecture diagram only
  score           Calculate quality score only
  anti-patterns   Detect anti-patterns only
  layers          Analyze layer structure only

Options:
  --format <type>   Output format: html, json, markdown (default: html)
  --output <file>   Output file path (default: architect-report.<ext>)
  --help            Show this help message

Examples:
  architect analyze ./src
  architect analyze ./src --format html --output report.html
  architect score ./src --format json
  architect anti-patterns ./backend/src
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  console.log('🏗️  Architect — Architecture Analysis');
  console.log(`📂 Path: ${options.path}`);
  console.log(`📋 Command: ${options.command}`);
  console.log(`📄 Format: ${options.format}\n`);

  try {
    switch (options.command) {
      case 'analyze': {
        const report = await architect.analyze(options.path);
        const projectName = report.projectInfo.name || basename(options.path);

        if (options.format === 'html') {
          const htmlGenerator = new HtmlReportGenerator();
          const html = htmlGenerator.generateHtml(report);
          const outputPath = options.output || `architect-report-${projectName}.html`;
          writeFileSync(outputPath, html);
          console.log(`✅ HTML report saved to: ${outputPath}`);
          console.log(`📊 Score: ${report.score.overall}/100`);
          console.log(`⚠️  Anti-patterns: ${report.antiPatterns.length}`);
        } else if (options.format === 'markdown') {
          const mdGenerator = new ReportGenerator();
          const markdown = mdGenerator.generateMarkdownReport(report);
          const outputPath = options.output || `architect-report-${projectName}.md`;
          writeFileSync(outputPath, markdown);
          console.log(`✅ Markdown report saved to: ${outputPath}`);
        } else {
          const outputPath = options.output || `architect-report-${projectName}.json`;
          writeFileSync(outputPath, JSON.stringify(report, null, 2));
          console.log(`✅ JSON report saved to: ${outputPath}`);
        }

        // Print summary to console
        console.log(`\n═══════════════════════════════════════`);
        console.log(`  SCORE: ${report.score.overall}/100`);
        console.log(`═══════════════════════════════════════`);
        console.log(`├─ Modularity: ${report.score.breakdown.modularity}`);
        console.log(`├─ Coupling:   ${report.score.breakdown.coupling}`);
        console.log(`├─ Cohesion:   ${report.score.breakdown.cohesion}`);
        console.log(`└─ Layering:   ${report.score.breakdown.layering}`);
        console.log(`\n📁 Files: ${report.projectInfo.totalFiles} | 📝 Lines: ${report.projectInfo.totalLines.toLocaleString()}`);
        console.log(`⚠️  Anti-patterns: ${report.antiPatterns.length}`);
        break;
      }

      case 'diagram': {
        const diagram = await architect.diagram(options.path);
        if (options.output) {
          writeFileSync(options.output, diagram);
          console.log(`✅ Diagram saved to: ${options.output}`);
        } else {
          console.log(diagram);
        }
        break;
      }

      case 'score': {
        const score = await architect.score(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(score, null, 2));
        } else {
          console.log(`Score: ${score.overall}/100`);
          for (const [name, value] of Object.entries(score.breakdown)) {
            console.log(`  ${name}: ${value}/100`);
          }
        }
        break;
      }

      case 'anti-patterns': {
        const patterns = await architect.antiPatterns(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(patterns, null, 2));
        } else {
          console.log(`Found ${patterns.length} anti-pattern(s):\n`);
          for (const p of patterns) {
            console.log(`  [${p.severity}] ${p.name}: ${p.description}`);
          }
        }
        break;
      }

      case 'layers': {
        const layers = await architect.layers(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(layers, null, 2));
        } else {
          for (const l of layers) {
            console.log(`${l.name}: ${l.files.length} files`);
          }
        }
        break;
      }

      default:
        console.error(`❌ Unknown command: ${options.command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
