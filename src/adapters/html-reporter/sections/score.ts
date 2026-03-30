import { AnalysisReport } from '../../../core/types/core.js';

import { scoreColor, scoreEmoji, scoreLabel } from "../utils_sections.js";

  export function renderScoreHero(report: AnalysisReport): string {
    const overall = report.score.overall;
    const circumference = 2 * Math.PI * 85;
    const offset = circumference * (1 - overall / 100);

    const breakdownItems = Object.entries(report.score.breakdown)
      .map(
        ([name, score]) => `
      <div class="score-item">
        <div class="name">${name}</div>
        <div class="val" style="color: ${scoreColor(score)}">${score} ${scoreEmoji(score)}</div>
        <div class="bar-container">
          <div class="bar" style="width: ${score}%; background: ${scoreColor(score)}"></div>
        </div>
      </div>`
      )
      .join('');

    return `
<div class="score-hero">
  <div class="score-circle">
    <svg viewBox="0 0 200 200" width="180" height="180">
      <circle class="bg" cx="100" cy="100" r="85" />
      <circle class="fg" cx="100" cy="100" r="85"
        stroke="${scoreColor(overall)}"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}" />
    </svg>
    <div class="score-value">
      <div class="number score-counter" data-target="${overall}" style="color: ${scoreColor(overall)}">0</div>
      <div class="label">/ 100</div>
      <div class="grade">${scoreLabel(overall)}</div>
    </div>
  </div>
  <div class="score-breakdown">
    ${breakdownItems}
  </div>
</div>`;
  }

  /**
   * Radar chart for the 4 score components
   */

  export function renderRadarChart(report: AnalysisReport): string {
    const entries = Object.entries(report.score.breakdown);
    return `
<h2 class="section-title">🎯 Health Radar</h2>
<div class="card" style="display: flex; justify-content: center;">
  <svg id="radar-chart" width="350" height="350" viewBox="0 0 350 350"></svg>
</div>`;
  }


  export function renderStats(report: AnalysisReport): string {
    return `
<div class="stats-grid">
  <div class="stat-card">
    <div class="value stat-counter" data-target="${report.projectInfo.totalFiles}">0</div>
    <div class="label">Files Scanned</div>
  </div>
  <div class="stat-card">
    <div class="value stat-counter" data-target="${report.projectInfo.totalLines}">0</div>
    <div class="label">Lines of Code</div>
  </div>
  <div class="stat-card">
    <div class="value stat-counter" data-target="${report.antiPatterns.length}">0</div>
    <div class="label">Anti-Patterns</div>
  </div>
  <div class="stat-card">
    <div class="value stat-counter" data-target="${report.dependencyGraph.edges.length}">0</div>
    <div class="label">Dependencies</div>
  </div>
</div>`;
  }
