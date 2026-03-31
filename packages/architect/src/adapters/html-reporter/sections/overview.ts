import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';

import { esc } from "../utils_sections.js";

  export function renderProjectOverview(report: AnalysisReport): string {
    const summary = report.projectSummary;
    if (!summary) return '';

    const modulesHtml = summary.modules.length > 0
      ? summary.modules.map(m => `
        <div class="overview-module">
          <div class="overview-module-name">${esc(m.name)}</div>
          <div class="overview-module-desc">${esc(m.description)}</div>
          <div class="overview-module-files">${m.files} file${m.files > 1 ? 's' : ''}</div>
        </div>`).join('')
      : '<div class="overview-empty">Nenhum módulo detectado</div>';

    const techHtml = summary.techStack
      .map(t => `<span class="overview-tag tech-tag">${esc(t)}</span>`)
      .join('');

    const keywordsHtml = summary.keywords
      .map(k => `<span class="overview-tag keyword-tag">${esc(k)}</span>`)
      .join('');

    const entryHtml = summary.entryPoints.length > 0
      ? summary.entryPoints.map(e => `<code class="overview-entry">${esc(e)}</code>`).join(' ')
      : '<span class="overview-empty">—</span>';

    return `
    <details class="section-accordion" id="overview" open>
      <summary class="section-accordion-header">📋 Project Overview</summary>
      <div class="section-accordion-body">
        <div class="overview-grid">
          <div class="overview-card overview-main">
            <div class="overview-label">O que é</div>
            <div class="overview-description">${esc(summary.description)}</div>
            <div class="overview-purpose-row">
              <span class="overview-purpose-label">Tipo:</span>
              <span class="overview-purpose-value">${esc(summary.purpose)}</span>
            </div>
          </div>
          <div class="overview-card">
            <div class="overview-label">Tech Stack</div>
            <div class="overview-tags">${techHtml || '<span class="overview-empty">—</span>'}</div>
          </div>
          <div class="overview-card">
            <div class="overview-label">Keywords</div>
            <div class="overview-tags">${keywordsHtml || '<span class="overview-empty">—</span>'}</div>
          </div>
          <div class="overview-card">
            <div class="overview-label">Entry Points</div>
            <div class="overview-entries">${entryHtml}</div>
          </div>
        </div>
        <div class="overview-modules-section">
          <div class="overview-label">Módulos Detectados (${summary.modules.length})</div>
          <div class="overview-modules-grid">
            ${modulesHtml}
          </div>
        </div>
      </div>
    </details>`;
  }
