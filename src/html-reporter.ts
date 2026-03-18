import { AnalysisReport, AntiPattern } from './types.js';

/**
 * Gera relatórios HTML visuais premium a partir de AnalysisReport
 */
export class HtmlReportGenerator {
  generateHtml(report: AnalysisReport): string {
    const grouped = this.groupAntiPatterns(report.antiPatterns);
    const sugGrouped = this.groupSuggestions(report.suggestions);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Architect Report — ${this.escapeHtml(report.projectInfo.name)}</title>
${this.getStyles()}
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
</head>
<body>
${this.renderHeader(report)}
<div class="container">
  ${this.renderScoreHero(report)}
  ${this.renderStats(report)}
  ${this.renderLayers(report)}
  ${this.renderAntiPatterns(report, grouped)}
  ${this.renderDiagram(report)}
  ${this.renderSuggestions(sugGrouped)}
</div>
${this.renderFooter()}
<script>
  mermaid.initialize({ theme: 'default', startOnLoad: true });
<\/script>
</body>
</html>`;
  }

  private scoreColor(score: number): string {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  private scoreEmoji(score: number): string {
    if (score >= 70) return '✅';
    if (score >= 50) return '⚠️';
    return '❌';
  }

  private scoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Attention';
    if (score >= 30) return 'Poor';
    return 'Critical';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private groupAntiPatterns(
    antiPatterns: AntiPattern[]
  ): Record<string, { count: number; severity: string; locations: string[]; suggestion: string }> {
    const grouped: Record<string, { count: number; severity: string; locations: string[]; suggestion: string }> = {};
    for (const p of antiPatterns) {
      if (!grouped[p.name]) {
        grouped[p.name] = { count: 0, severity: p.severity, locations: [], suggestion: p.suggestion };
      }
      grouped[p.name].count++;
      if (grouped[p.name].locations.length < 10) {
        grouped[p.name].locations.push(p.location);
      }
    }
    return grouped;
  }

  private groupSuggestions(
    suggestions: Array<{ priority: string; title: string; description: string; impact: string }>
  ): Array<{ priority: string; title: string; description: string; impact: string; count: number }> {
    const map = new Map<string, { priority: string; title: string; description: string; impact: string; count: number }>();
    for (const s of suggestions) {
      const key = `${s.title}|${s.priority}`;
      if (!map.has(key)) {
        map.set(key, { ...s, count: 0 });
      }
      map.get(key)!.count++;
    }
    return Array.from(map.values()).slice(0, 15);
  }

  private renderHeader(report: AnalysisReport): string {
    const date = new Date(report.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `
<div class="header">
  <h1>🏗️ Architect</h1>
  <p class="subtitle">Architecture Analysis Report</p>
  <div class="meta">
    <span>📂 <strong>${this.escapeHtml(report.projectInfo.name)}</strong></span>
    <span>📁 <strong>${report.projectInfo.totalFiles}</strong> files</span>
    <span>📝 <strong>${report.projectInfo.totalLines.toLocaleString()}</strong> lines</span>
    <span>💻 <strong>${report.projectInfo.primaryLanguages.join(', ')}</strong></span>
    ${report.projectInfo.frameworks.length > 0 ? `<span>🔧 <strong>${report.projectInfo.frameworks.join(', ')}</strong></span>` : ''}
    <span>📅 <strong>${date}</strong></span>
  </div>
</div>`;
  }

  private renderScoreHero(report: AnalysisReport): string {
    const overall = report.score.overall;
    const circumference = 2 * Math.PI * 85;
    const offset = circumference * (1 - overall / 100);

    const breakdownItems = Object.entries(report.score.breakdown)
      .map(
        ([name, score]) => `
      <div class="score-item">
        <div class="name">${name}</div>
        <div class="val" style="color: ${this.scoreColor(score)}">${score} ${this.scoreEmoji(score)}</div>
        <div class="bar-container">
          <div class="bar" style="width: ${score}%; background: ${this.scoreColor(score)}"></div>
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
        stroke="${this.scoreColor(overall)}"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}" />
    </svg>
    <div class="score-value">
      <div class="number" style="color: ${this.scoreColor(overall)}">${overall}</div>
      <div class="label">/ 100</div>
      <div class="grade">${this.scoreLabel(overall)}</div>
    </div>
  </div>
  <div class="score-breakdown">
    ${breakdownItems}
  </div>
</div>`;
  }

  private renderStats(report: AnalysisReport): string {
    return `
<div class="stats-grid">
  <div class="stat-card">
    <div class="value">${report.projectInfo.totalFiles}</div>
    <div class="label">Files Scanned</div>
  </div>
  <div class="stat-card">
    <div class="value">${report.projectInfo.totalLines.toLocaleString()}</div>
    <div class="label">Lines of Code</div>
  </div>
  <div class="stat-card">
    <div class="value">${report.antiPatterns.length}</div>
    <div class="label">Anti-Patterns</div>
  </div>
  <div class="stat-card">
    <div class="value">${report.dependencyGraph.edges.length}</div>
    <div class="label">Dependencies</div>
  </div>
</div>`;
  }

  private renderLayers(report: AnalysisReport): string {
    if (report.layers.length === 0) return '';

    const layerColors: Record<string, string> = {
      API: '#ec4899',
      Service: '#3b82f6',
      Data: '#10b981',
      UI: '#f59e0b',
      Infrastructure: '#8b5cf6',
    };

    const cards = report.layers
      .map((l) => {
        const color = layerColors[l.name] || '#64748b';
        return `
      <div class="layer-card" style="--layer-color: ${color}">
        <div class="count" style="color: ${color}">${l.files.length}</div>
        <div class="name">${l.name}</div>
        <div class="desc">${this.escapeHtml(l.description)}</div>
      </div>`;
      })
      .join('');

    return `
<h2 class="section-title">📐 Architectural Layers</h2>
<div class="layers-grid">${cards}</div>`;
  }

  private renderAntiPatterns(
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

    const rows = Object.entries(grouped)
      .sort((a, b) => b[1].count - a[1].count)
      .map(
        ([name, data]) => `
        <tr>
          <td><strong>${this.escapeHtml(name)}</strong></td>
          <td class="count-cell">${data.count}</td>
          <td><span class="severity-badge severity-${data.severity}">${data.severity}</span></td>
          <td><small class="suggestion">${this.escapeHtml(data.suggestion)}</small></td>
          <td><div class="locations">${data.locations
            .slice(0, 5)
            .map((l) => `<code>${this.escapeHtml(l)}</code>`)
            .join(' ')}${data.locations.length > 5 ? ` <em>+${data.count - 5} more</em>` : ''}</div></td>
        </tr>`
      )
      .join('');

    return `
<h2 class="section-title">⚠️ Anti-Patterns (${report.antiPatterns.length})</h2>
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

  private renderDiagram(report: AnalysisReport): string {
    if (!report.diagram.mermaid) return '';

    return `
<h2 class="section-title">📊 Architecture Diagram</h2>
<div class="card">
  <div class="mermaid-container">
    <pre class="mermaid">${this.escapeHtml(report.diagram.mermaid)}</pre>
  </div>
</div>`;
  }

  private renderSuggestions(
    suggestions: Array<{ priority: string; title: string; description: string; impact: string; count: number }>
  ): string {
    if (suggestions.length === 0) return '';

    const rows = suggestions
      .map(
        (s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><span class="severity-badge severity-${s.priority}">${s.priority}</span></td>
          <td>
            <strong>${this.escapeHtml(s.title)}</strong>
            ${s.count > 1 ? `<span class="count-badge">×${s.count}</span>` : ''}
            <br/><small class="suggestion">${this.escapeHtml(s.description)}</small>
          </td>
          <td class="impact">${this.escapeHtml(s.impact)}</td>
        </tr>`
      )
      .join('');

    return `
<h2 class="section-title">💡 Refactoring Suggestions</h2>
<div class="card">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Priority</th>
        <th>Suggestion</th>
        <th>Impact</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
  }

  private renderFooter(): string {
    return `
<div class="footer">
  <p>Generated by <a href="https://github.com/camilogivago/architect">🏗️ Architect</a> — AI-powered architecture analysis</p>
  <p>By <strong>Camilo Girardelli</strong> · <a href="https://girardelli.tech">Girardelli Tecnologia</a></p>
</div>`;
  }

  private getStyles(): string {
    return `<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    line-height: 1.6;
    min-height: 100vh;
  }

  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

  /* ── Header ── */
  .header {
    text-align: center;
    padding: 3rem 2rem;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%);
    border-bottom: 1px solid #334155;
    margin-bottom: 2rem;
  }
  .header h1 {
    font-size: 2.5rem;
    font-weight: 900;
    background: linear-gradient(135deg, #818cf8, #c084fc, #f472b6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }
  .header .subtitle { color: #94a3b8; font-size: 1.1rem; font-weight: 300; }
  .header .meta {
    margin-top: 1rem;
    display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;
  }
  .header .meta span {
    background: #1e293b; padding: 0.4rem 1rem; border-radius: 99px;
    font-size: 0.85rem; color: #94a3b8; border: 1px solid #334155;
  }
  .header .meta span strong { color: #e2e8f0; }

  /* ── Score Hero ── */
  .score-hero {
    display: flex; align-items: center; justify-content: center; gap: 3rem;
    padding: 2.5rem;
    background: linear-gradient(135deg, #1e293b, #1e1b4b);
    border-radius: 24px; border: 1px solid #334155;
    margin-bottom: 2rem; flex-wrap: wrap;
  }
  .score-circle { position: relative; width: 180px; height: 180px; }
  .score-circle svg { transform: rotate(-90deg); }
  .score-circle circle { fill: none; stroke-width: 10; stroke-linecap: round; }
  .score-circle .bg { stroke: #334155; }
  .score-circle .fg { transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1); }
  .score-value {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    text-align: center;
  }
  .score-value .number { font-size: 3rem; font-weight: 900; line-height: 1; }
  .score-value .label { font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; }
  .score-value .grade { font-size: 0.75rem; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }

  .score-breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .score-item {
    padding: 1rem 1.5rem; background: rgba(255,255,255,0.03);
    border-radius: 12px; border: 1px solid #334155; min-width: 200px;
  }
  .score-item .name { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 0.3rem; }
  .score-item .bar-container { background: #1e293b; border-radius: 99px; height: 8px; margin-top: 0.5rem; overflow: hidden; }
  .score-item .bar { height: 100%; border-radius: 99px; transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1); }
  .score-item .val { font-size: 1.5rem; font-weight: 700; }

  /* ── Stats Grid ── */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat-card {
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid #334155; border-radius: 16px; padding: 1.5rem; text-align: center;
  }
  .stat-card .value {
    font-size: 2rem; font-weight: 800;
    background: linear-gradient(135deg, #818cf8, #c084fc);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .stat-card .label { font-size: 0.85rem; color: #94a3b8; margin-top: 0.3rem; }

  /* ── Section Title ── */
  .section-title {
    font-size: 1.4rem; font-weight: 700; margin: 2.5rem 0 1rem;
    display: flex; align-items: center; gap: 0.5rem;
  }

  /* ── Cards ── */
  .card {
    background: #1e293b; border-radius: 16px; border: 1px solid #334155;
    padding: 1.5rem; margin-bottom: 1rem; overflow-x: auto;
  }
  .success-card { border-color: #22c55e40; color: #22c55e; text-align: center; padding: 2rem; font-size: 1.1rem; }

  /* ── Layers Grid ── */
  .layers-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .layer-card {
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border: 1px solid #334155; border-radius: 16px; padding: 1.5rem;
    text-align: center; position: relative; overflow: hidden;
  }
  .layer-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--layer-color, #64748b);
  }
  .layer-card .count { font-size: 2.5rem; font-weight: 900; line-height: 1; }
  .layer-card .name { font-size: 1rem; color: #94a3b8; margin-top: 0.3rem; font-weight: 600; }
  .layer-card .desc { font-size: 0.75rem; color: #475569; margin-top: 0.5rem; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #334155; }
  th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600; }
  .count-cell { font-weight: 700; font-size: 1.1rem; }
  .impact { color: #94a3b8; font-size: 0.85rem; }
  .suggestion { color: #64748b; font-size: 0.8rem; }

  .severity-badge {
    display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.5px;
  }
  .severity-CRITICAL { background: #dc262620; color: #ef4444; border: 1px solid #ef444440; }
  .severity-HIGH { background: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40; }
  .severity-MEDIUM { background: #3b82f620; color: #60a5fa; border: 1px solid #60a5fa40; }
  .severity-LOW { background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; }

  .count-badge {
    display: inline-block; background: #818cf820; color: #818cf8; padding: 0.1rem 0.4rem;
    border-radius: 99px; font-size: 0.7rem; margin-left: 0.5rem; font-weight: 600;
  }

  .locations { font-size: 0.75rem; color: #64748b; }
  .locations code { background: #0f172a; padding: 1px 4px; border-radius: 3px; font-size: 0.7rem; }

  /* ── Mermaid ── */
  .mermaid-container {
    background: #f8fafc; border-radius: 12px; padding: 2rem; text-align: center; color: #0f172a;
  }

  /* ── Footer ── */
  .footer {
    text-align: center; padding: 2rem; color: #475569; font-size: 0.85rem;
    border-top: 1px solid #1e293b; margin-top: 3rem;
  }
  .footer a { color: #818cf8; text-decoration: none; }
  .footer a:hover { text-decoration: underline; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .score-hero { flex-direction: column; gap: 1.5rem; }
    .score-breakdown { grid-template-columns: 1fr; }
    .header h1 { font-size: 1.8rem; }
    .container { padding: 1rem; }
  }

  /* ── Print ── */
  @media print {
    body { background: white; color: #1e293b; }
    .header { background: white; border-bottom: 2px solid #e2e8f0; }
    .header h1 { -webkit-text-fill-color: #4f46e5; }
    .card, .stat-card, .score-hero, .layer-card, .score-item {
      background: white; border-color: #e2e8f0;
    }
    .mermaid-container { border: 1px solid #e2e8f0; }
  }
</style>`;
  }
}
