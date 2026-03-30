import { groupAntiPatterns, groupSuggestions, escapeHtml } from "./html-reporter/utils.js";
import { renderHeader, renderFooter } from "./html-reporter/sections/header.js";
import { renderProjectOverview } from "./html-reporter/sections/overview.js";
import { renderScoreHero, renderRadarChart, renderStats } from "./html-reporter/sections/score.js";
import { renderLayers, renderDependencyGraph } from "./html-reporter/sections/layers.js";
import { renderAntiPatternBubbles, renderAntiPatterns } from "./html-reporter/sections/anti-patterns.js";
import { renderSuggestions } from "./html-reporter/sections/suggestions.js";
import { renderRefactoringPlan } from "./html-reporter/sections/refactoring-plan.js";
import { renderAgentSuggestions } from "./html-reporter/sections/agents.js";
import { getScripts } from "./html-reporter/scripts.js";
import { getStyles } from "./html-reporter/styles.js";
import { AnalysisReport, AntiPattern, RefactoringPlan, RefactorStep } from './types.js';
import { AgentSuggestion } from './agent-generator/index.js';

/**
 * Generates premium visual HTML reports from AnalysisReport.
 * Features: D3.js force graph, bubble charts, radar chart, animated counters.
 */
export class HtmlReportGenerator {
  generateHtml(report: AnalysisReport, plan?: RefactoringPlan, agentSuggestion?: AgentSuggestion): string {
    const grouped = groupAntiPatterns(report.antiPatterns);
    const sugGrouped = groupSuggestions(report.suggestions);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Architect Report — ${escapeHtml(report.projectInfo.name)}</title>
${getStyles()}
<script src="https://cdn.jsdelivr.net/npm/d3@7"><\/script>
</head>
<body>
${renderHeader(report)}
<div class="report-layout">
  <nav class="sidebar" id="reportSidebar">
    <div class="sidebar-title">Navigation</div>
    <a href="#score" class="sidebar-link active" data-section="score">📊 Score</a>
    ${report.projectSummary ? `<a href="#overview" class="sidebar-link" data-section="overview">📋 Overview</a>` : ''}
    <a href="#layers" class="sidebar-link" data-section="layers">📐 Layers & Graph</a>
    <a href="#anti-patterns" class="sidebar-link" data-section="anti-patterns">⚠️ Anti-Patterns (${report.antiPatterns.length})</a>
    <a href="#suggestions" class="sidebar-link" data-section="suggestions">💡 Suggestions (${report.suggestions.length})</a>
    ${plan ? `<a href="#refactoring" class="sidebar-link" data-section="refactoring">🔧 Refactoring (${plan.steps.length})</a>` : ''}
    ${agentSuggestion ? `<a href="#agents" class="sidebar-link" data-section="agents">🤖 Agents</a>` : ''}
  </nav>
  <button class="sidebar-toggle" onclick="document.getElementById('reportSidebar').classList.toggle('sidebar-open')">☰</button>

  <div class="container">
    <div id="score">
      ${renderScoreHero(report)}
      ${renderRadarChart(report)}
      ${renderStats(report)}
    </div>

    ${renderProjectOverview(report)}

    <details class="section-accordion" id="layers" open>
      <summary class="section-accordion-header">📐 Layer Analysis & Dependencies</summary>
      <div class="section-accordion-body">
        ${renderLayers(report)}
        ${renderDependencyGraph(report)}
      </div>
    </details>

    <details class="section-accordion" id="anti-patterns" open>
      <summary class="section-accordion-header">⚠️ Anti-Patterns (${report.antiPatterns.length})</summary>
      <div class="section-accordion-body">
        ${renderAntiPatternBubbles(report, grouped)}
        ${renderAntiPatterns(report, grouped)}
      </div>
    </details>

    <details class="section-accordion" id="suggestions">
      <summary class="section-accordion-header">💡 Suggestions (${report.suggestions.length})</summary>
      <div class="section-accordion-body">
        ${renderSuggestions(sugGrouped)}
      </div>
    </details>

    ${plan ? `<details class="section-accordion" id="refactoring" open>
      <summary class="section-accordion-header">🔧 Refactoring Plan (${plan.steps.length} steps, ${plan.totalOperations} operations)</summary>
      <div class="section-accordion-body">
        ${renderRefactoringPlan(plan)}
      </div>
    </details>` : ''}

    ${agentSuggestion ? `<details class="section-accordion" id="agents" open>
      <summary class="section-accordion-header">🤖 Agent System</summary>
      <div class="section-accordion-body">
        ${renderAgentSuggestions(agentSuggestion)}
      </div>
    </details>` : ''}
  </div>
</div>
${renderFooter()}
${getScripts(report)}
</body>
</html>`;
  }

}
