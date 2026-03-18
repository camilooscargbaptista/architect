import { AnalysisReport, AntiPattern } from './types.js';

/**
 * Generates premium visual HTML reports from AnalysisReport.
 * Features: D3.js force graph, bubble charts, radar chart, animated counters.
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
<script src="https://cdn.jsdelivr.net/npm/d3@7"><\/script>
</head>
<body>
${this.renderHeader(report)}
<div class="container">
  ${this.renderScoreHero(report)}
  ${this.renderRadarChart(report)}
  ${this.renderStats(report)}
  ${this.renderLayers(report)}
  ${this.renderDependencyGraph(report)}
  ${this.renderAntiPatternBubbles(report, grouped)}
  ${this.renderAntiPatterns(report, grouped)}
  ${this.renderSuggestions(sugGrouped)}
</div>
${this.renderFooter()}
${this.getScripts(report)}
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
      <div class="number score-counter" data-target="${overall}" style="color: ${this.scoreColor(overall)}">0</div>
      <div class="label">/ 100</div>
      <div class="grade">${this.scoreLabel(overall)}</div>
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
  private renderRadarChart(report: AnalysisReport): string {
    const entries = Object.entries(report.score.breakdown);
    return `
<h2 class="section-title">🎯 Health Radar</h2>
<div class="card" style="display: flex; justify-content: center;">
  <svg id="radar-chart" width="350" height="350" viewBox="0 0 350 350"></svg>
</div>`;
  }

  private renderStats(report: AnalysisReport): string {
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

  /**
   * Interactive D3.js force-directed dependency graph
   */
  private renderDependencyGraph(report: AnalysisReport): string {
    if (report.dependencyGraph.edges.length === 0) return '';

    // Build node data with connection counts
    const connectionCount: Record<string, number> = {};
    for (const edge of report.dependencyGraph.edges) {
      connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
      connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
    }

    const layerMap: Record<string, string> = {};
    for (const layer of report.layers) {
      for (const file of layer.files) {
        layerMap[file] = layer.name;
      }
    }

    const nodes = report.dependencyGraph.nodes.map(n => ({
      id: n,
      name: n.split('/').pop() || n,
      connections: connectionCount[n] || 0,
      layer: layerMap[n] || 'Other',
    }));

    const links = report.dependencyGraph.edges.map(e => ({
      source: e.from,
      target: e.to,
    }));

    return `
<h2 class="section-title">🔗 Dependency Graph</h2>
<div class="card graph-card">
  <div class="graph-legend">
    <span class="legend-item"><span class="legend-dot" style="background: #ec4899"></span> API</span>
    <span class="legend-item"><span class="legend-dot" style="background: #3b82f6"></span> Service</span>
    <span class="legend-item"><span class="legend-dot" style="background: #10b981"></span> Data</span>
    <span class="legend-item"><span class="legend-dot" style="background: #f59e0b"></span> UI</span>
    <span class="legend-item"><span class="legend-dot" style="background: #8b5cf6"></span> Infra</span>
    <span class="legend-item"><span class="legend-dot" style="background: #64748b"></span> Other</span>
  </div>
  <div id="dep-graph" style="width:100%; min-height:400px;"></div>
  <div class="graph-hint">🖱️ Drag nodes to explore • Node size = number of connections</div>
</div>
<script type="application/json" id="graph-nodes">${JSON.stringify(nodes)}<\/script>
<script type="application/json" id="graph-links">${JSON.stringify(links)}<\/script>`;
  }

  /**
   * Bubble chart for anti-patterns — bigger = more severe
   */
  private renderAntiPatternBubbles(
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

  private renderAntiPatterns(
    report: AnalysisReport,
    grouped: Record<string, { count: number; severity: string; locations: string[]; suggestion: string }>
  ): string {
    if (report.antiPatterns.length === 0) return '';

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
  <p>Generated by <a href="https://github.com/camilooscargbaptista/architect">🏗️ Architect</a> — AI-powered architecture analysis</p>
  <p>By <strong>Camilo Girardelli</strong> · <a href="https://www.girardellitecnologia.com">Girardelli Tecnologia</a></p>
</div>`;
  }

  /**
   * All JavaScript for D3.js visualizations, animated counters, and radar chart
   */
  private getScripts(report: AnalysisReport): string {
    const breakdown = report.score.breakdown;
    return `<script>
// ── Animated Counters ──
document.addEventListener('DOMContentLoaded', () => {
  const counters = document.querySelectorAll('.score-counter, .stat-counter');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target || '0');
        animateCounter(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
});

function animateCounter(el, target) {
  const duration = 1500;
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * ease).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Radar Chart ──
(function() {
  const data = [
    { axis: 'Modularity', value: ${breakdown.modularity} },
    { axis: 'Coupling', value: ${breakdown.coupling} },
    { axis: 'Cohesion', value: ${breakdown.cohesion} },
    { axis: 'Layering', value: ${breakdown.layering} },
  ];

  const svg = d3.select('#radar-chart');
  const w = 350, h = 350, cx = w/2, cy = h/2, maxR = 120;
  const levels = 5;
  const total = data.length;
  const angleSlice = (Math.PI * 2) / total;

  // Grid circles
  for (let i = 1; i <= levels; i++) {
    const r = (maxR / levels) * i;
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', r)
      .attr('fill', 'none').attr('stroke', '#334155').attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '4,4');

    svg.append('text')
      .attr('x', cx + 4).attr('y', cy - r + 4)
      .text(Math.round(100 / levels * i))
      .attr('fill', '#475569').attr('font-size', '10px');
  }

  // Axis lines
  data.forEach((d, i) => {
    const angle = angleSlice * i - Math.PI/2;
    const x = cx + Math.cos(angle) * (maxR + 20);
    const y = cy + Math.sin(angle) * (maxR + 20);

    svg.append('line')
      .attr('x1', cx).attr('y1', cy).attr('x2', cx + Math.cos(angle) * maxR).attr('y2', cy + Math.sin(angle) * maxR)
      .attr('stroke', '#334155').attr('stroke-width', 1);

    svg.append('text')
      .attr('x', x).attr('y', y)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', '#94a3b8').attr('font-size', '12px').attr('font-weight', '600')
      .text(d.axis);
  });

  // Data polygon
  const points = data.map((d, i) => {
    const angle = angleSlice * i - Math.PI/2;
    const r = (d.value / 100) * maxR;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  });

  const pointsStr = points.map(p => p.join(',')).join(' ');

  svg.append('polygon')
    .attr('points', pointsStr)
    .attr('fill', 'rgba(129, 140, 248, 0.15)')
    .attr('stroke', '#818cf8').attr('stroke-width', 2);

  // Data dots
  points.forEach((p, i) => {
    const color = data[i].value >= 70 ? '#22c55e' : data[i].value >= 50 ? '#f59e0b' : '#ef4444';
    svg.append('circle')
      .attr('cx', p[0]).attr('cy', p[1]).attr('r', 5)
      .attr('fill', color).attr('stroke', '#0f172a').attr('stroke-width', 2);

    svg.append('text')
      .attr('x', p[0]).attr('y', p[1] - 12)
      .attr('text-anchor', 'middle')
      .attr('fill', color).attr('font-size', '12px').attr('font-weight', '700')
      .text(data[i].value);
  });
})();

// ── D3 Force Dependency Graph ──
(function() {
  const nodesEl = document.getElementById('graph-nodes');
  const linksEl = document.getElementById('graph-links');
  if (!nodesEl || !linksEl) return;

  const nodes = JSON.parse(nodesEl.textContent || '[]');
  const links = JSON.parse(linksEl.textContent || '[]');
  if (nodes.length === 0) return;

  const container = document.getElementById('dep-graph');
  const width = container.clientWidth || 800;
  const height = Math.max(400, nodes.length * 25);
  container.style.height = height + 'px';

  const layerColors = {
    API: '#ec4899', Service: '#3b82f6', Data: '#10b981',
    UI: '#f59e0b', Infrastructure: '#8b5cf6', Other: '#64748b',
  };

  const svg = d3.select('#dep-graph').append('svg')
    .attr('width', width).attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead').attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20).attr('refY', 0).attr('orient', 'auto')
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .append('path').attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', '#475569');

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => Math.max(d.connections * 3 + 12, 15)));

  const link = svg.append('g')
    .selectAll('line').data(links).join('line')
    .attr('stroke', '#334155').attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.6).attr('marker-end', 'url(#arrowhead)');

  const node = svg.append('g')
    .selectAll('g').data(nodes).join('g')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  // Node circles — size based on connections
  node.append('circle')
    .attr('r', d => Math.max(d.connections * 3 + 6, 8))
    .attr('fill', d => layerColors[d.layer] || '#64748b')
    .attr('stroke', '#0f172a').attr('stroke-width', 2)
    .attr('opacity', 0.85);

  // Node labels
  node.append('text')
    .text(d => d.name.replace(/\\.[^.]+$/, ''))
    .attr('x', 0).attr('y', d => -(Math.max(d.connections * 3 + 6, 8) + 6))
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8').attr('font-size', '10px').attr('font-weight', '500');

  // Tooltip on hover
  node.append('title')
    .text(d => d.id + '\\nConnections: ' + d.connections + '\\nLayer: ' + d.layer);

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
  });
})();

// ── Bubble Chart ──
(function() {
  const dataEl = document.getElementById('bubble-data');
  if (!dataEl) return;

  const bubbles = JSON.parse(dataEl.textContent || '[]');
  if (bubbles.length === 0) return;

  const container = document.getElementById('bubble-chart');
  const width = container.clientWidth || 600;
  const height = 300;

  const svg = d3.select('#bubble-chart').append('svg')
    .attr('width', width).attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  const simulation = d3.forceSimulation(bubbles)
    .force('charge', d3.forceManyBody().strength(5))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.radius + 4))
    .stop();

  for (let i = 0; i < 120; i++) simulation.tick();

  const g = svg.selectAll('g').data(bubbles).join('g')
    .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

  // Glow effect
  g.append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color + '20')
    .attr('stroke', d => d.color).attr('stroke-width', 2)
    .attr('opacity', 0)
    .transition().duration(800).delay((d, i) => i * 200)
    .attr('opacity', 1);

  // Inner circle
  g.append('circle')
    .attr('r', d => d.radius * 0.7)
    .attr('fill', d => d.color + '30')
    .attr('opacity', 0)
    .transition().duration(800).delay((d, i) => i * 200)
    .attr('opacity', 1);

  // Name
  g.append('text')
    .text(d => d.name)
    .attr('text-anchor', 'middle').attr('dy', '-0.3em')
    .attr('fill', '#e2e8f0').attr('font-size', d => Math.max(d.radius / 4, 10) + 'px')
    .attr('font-weight', '700');

  // Count badge
  g.append('text')
    .text(d => '×' + d.count)
    .attr('text-anchor', 'middle').attr('dy', '1.2em')
    .attr('fill', d => d.color).attr('font-size', d => Math.max(d.radius / 5, 9) + 'px')
    .attr('font-weight', '600');

  // Severity label
  g.append('text')
    .text(d => d.severity)
    .attr('text-anchor', 'middle').attr('dy', '2.5em')
    .attr('fill', '#64748b').attr('font-size', '9px').attr('text-transform', 'uppercase');
})();
<\/script>`;
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

  /* ── Graph ── */
  .graph-card { padding: 1rem; }
  .graph-legend {
    display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;
    justify-content: center;
  }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #94a3b8; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .graph-hint {
    text-align: center; font-size: 0.75rem; color: #475569; margin-top: 0.5rem;
    font-style: italic;
  }
  #dep-graph svg { background: rgba(0,0,0,0.2); border-radius: 12px; }

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
  }
</style>`;
  }
}
