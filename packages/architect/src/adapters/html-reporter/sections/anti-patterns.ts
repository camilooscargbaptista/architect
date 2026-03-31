import { AnalysisReport} from '@girardelli/architect-core/src/core/types/core.js';

import { escapeHtml } from "../utils_sections.js";

  export function renderAntiPatternBubbles(
    report: AnalysisReport,
    grouped: Record<string, { count: number; severity: string; locations: string[]; suggestion: string }>
  ): string {
    if (report.antiPatterns.length === 0) {
      return `
<h2 class="section-title">✅ Anti-Patterns</h2>
<div class="card success-card">
  <p>No significant anti-patterns detected. Excellent architecture!</p>
</div>`;
    }

    const severityWeight: Record<string, number> = {
      CRITICAL: 80, HIGH: 60, MEDIUM: 40, LOW: 25,
    };

    const severityColor: Record<string, string> = {
      CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#60a5fa', LOW: '#22c55e',
    };

    const bubbles = Object.entries(grouped).map(([name, data]) => ({
      name,
      count: data.count,
      severity: data.severity,
      radius: (severityWeight[data.severity] || 30) + data.count * 8,
      color: severityColor[data.severity] || '#64748b',
    }));

    return `
<h2 class="section-title">🫧 Anti-Pattern Impact Map</h2>
<div class="card" style="display:flex; justify-content:center;">
  <div id="bubble-chart" style="width:100%; min-height:300px;"></div>
</div>
<script type="application/json" id="bubble-data">${JSON.stringify(bubbles)}<\/script>`;
  }


  export function renderAntiPatterns(
    report: AnalysisReport,
    grouped: Record<string, { count: number; severity: string; locations: string[]; suggestion: string }>
  ): string {
    if (report.antiPatterns.length === 0) return '';

    const rows = Object.entries(grouped)
      .sort((a, b) => b[1].count - a[1].count)
      .map(
        ([name, data]) => `
        <tr>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td class="count-cell">${data.count}</td>
          <td><span class="severity-badge severity-${data.severity}">${data.severity}</span></td>
          <td><small class="suggestion">${escapeHtml(data.suggestion)}</small></td>
          <td><div class="locations">${data.locations
            .slice(0, 5)
            .map((l) => `<code>${escapeHtml(l)}</code>`)
            .join(' ')}${data.locations.length > 5 ? ` <em>+${data.count - 5} more</em>` : ''}</div></td>
        </tr>`
      )
      .join('');

    return `
<h2 class="section-title">⚠️ Anti-Pattern Details (${report.antiPatterns.length})</h2>
<div class="card">
  <table>
    <thead>
      <tr>
        <th>Pattern</th>
        <th>Count</th>
        <th>Severity</th>
        <th>Suggestion</th>
        <th>Locations</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
  }
