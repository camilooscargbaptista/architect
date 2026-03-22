import { AnalysisReport, AntiPattern, RefactoringPlan, RefactorStep } from './types.js';
import { AgentSuggestion } from './agent-generator/index.js';

/**
 * Generates premium visual HTML reports from AnalysisReport.
 * Features: D3.js force graph, bubble charts, radar chart, animated counters.
 */
export class HtmlReportGenerator {
  generateHtml(report: AnalysisReport, plan?: RefactoringPlan, agentSuggestion?: AgentSuggestion): string {
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
      ${this.renderScoreHero(report)}
      ${this.renderRadarChart(report)}
      ${this.renderStats(report)}
    </div>

    ${this.renderProjectOverview(report)}

    <details class="section-accordion" id="layers" open>
      <summary class="section-accordion-header">📐 Layer Analysis & Dependencies</summary>
      <div class="section-accordion-body">
        ${this.renderLayers(report)}
        ${this.renderDependencyGraph(report)}
      </div>
    </details>

    <details class="section-accordion" id="anti-patterns" open>
      <summary class="section-accordion-header">⚠️ Anti-Patterns (${report.antiPatterns.length})</summary>
      <div class="section-accordion-body">
        ${this.renderAntiPatternBubbles(report, grouped)}
        ${this.renderAntiPatterns(report, grouped)}
      </div>
    </details>

    <details class="section-accordion" id="suggestions">
      <summary class="section-accordion-header">💡 Suggestions (${report.suggestions.length})</summary>
      <div class="section-accordion-body">
        ${this.renderSuggestions(sugGrouped)}
      </div>
    </details>

    ${plan ? `<details class="section-accordion" id="refactoring" open>
      <summary class="section-accordion-header">🔧 Refactoring Plan (${plan.steps.length} steps, ${plan.totalOperations} operations)</summary>
      <div class="section-accordion-body">
        ${this.renderRefactoringPlan(plan)}
      </div>
    </details>` : ''}

    ${agentSuggestion ? `<details class="section-accordion" id="agents" open>
      <summary class="section-accordion-header">🤖 Agent System</summary>
      <div class="section-accordion-body">
        ${this.renderAgentSuggestions(agentSuggestion)}
      </div>
    </details>` : ''}
  </div>
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

  private renderProjectOverview(report: AnalysisReport): string {
    const summary = report.projectSummary;
    if (!summary) return '';

    const modulesHtml = summary.modules.length > 0
      ? summary.modules.map(m => `
        <div class="overview-module">
          <div class="overview-module-name">${this.esc(m.name)}</div>
          <div class="overview-module-desc">${this.esc(m.description)}</div>
          <div class="overview-module-files">${m.files} file${m.files > 1 ? 's' : ''}</div>
        </div>`).join('')
      : '<div class="overview-empty">Nenhum módulo detectado</div>';

    const techHtml = summary.techStack
      .map(t => `<span class="overview-tag tech-tag">${this.esc(t)}</span>`)
      .join('');

    const keywordsHtml = summary.keywords
      .map(k => `<span class="overview-tag keyword-tag">${this.esc(k)}</span>`)
      .join('');

    const entryHtml = summary.entryPoints.length > 0
      ? summary.entryPoints.map(e => `<code class="overview-entry">${this.esc(e)}</code>`).join(' ')
      : '<span class="overview-empty">—</span>';

    return `
    <details class="section-accordion" id="overview" open>
      <summary class="section-accordion-header">📋 Project Overview</summary>
      <div class="section-accordion-body">
        <div class="overview-grid">
          <div class="overview-card overview-main">
            <div class="overview-label">O que é</div>
            <div class="overview-description">${this.esc(summary.description)}</div>
            <div class="overview-purpose-row">
              <span class="overview-purpose-label">Tipo:</span>
              <span class="overview-purpose-value">${this.esc(summary.purpose)}</span>
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

  private esc(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

    // Build real file set — only files that appear as SOURCE in edges (these are real scanned files)
    const realFiles = new Set(report.dependencyGraph.edges.map(e => e.from));

    // Count connections only for real files
    const connectionCount: Record<string, number> = {};
    for (const edge of report.dependencyGraph.edges) {
      if (realFiles.has(edge.from)) {
        connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
      }
      if (realFiles.has(edge.to)) {
        connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
      }
    }

    // Build layer map from report layers
    const layerMap: Record<string, string> = {};
    for (const layer of report.layers) {
      for (const file of layer.files) {
        layerMap[file] = layer.name;
      }
    }

    // Create nodes only from real files
    const allNodes = [...realFiles].map(n => ({
      id: n,
      name: n.split('/').pop() || n,
      connections: connectionCount[n] || 0,
      layer: layerMap[n] || 'Other',
    }));

    // ── Fallback: color by module/directory when layer detection is weak ──
    const otherCount = allNodes.filter(n => n.layer === 'Other').length;
    const useModuleColoring = allNodes.length > 0 && (otherCount / allNodes.length) > 0.7;

    // Palette for module-based coloring (10 distinct, vibrant colors)
    const modulePalette = [
      '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1',
    ];

    let moduleColorMap: Record<string, string> = {};
    if (useModuleColoring) {
      // Extract module (first meaningful directory) from each node path
      const getModule = (filePath: string): string => {
        const parts = filePath.split('/');
        if (parts.length < 2) return 'root';
        const first = parts[0];
        // If first dir is common source dir, use second level
        if (['src', 'lib', 'app', 'packages', 'modules', 'features', 'apps'].includes(first)) {
          return parts.length > 2 ? parts[1] : first;
        }
        return first;
      };

      // Assign colors to modules
      const moduleNames = [...new Set(allNodes.map(n => getModule(n.id)))];
      moduleNames.forEach((mod, i) => {
        moduleColorMap[mod] = modulePalette[i % modulePalette.length];
      });

      // Reassign layer field to module name for coloring
      for (const node of allNodes) {
        node.layer = getModule(node.id);
      }
    }

    // Build links only between real files
    const allLinks = report.dependencyGraph.edges
      .filter(e => realFiles.has(e.from) && realFiles.has(e.to))
      .map(e => ({ source: e.from, target: e.to }));

    // Limit to top N most-connected nodes for large projects
    const maxNodes = 60;
    const sortedNodes = [...allNodes].sort((a, b) => b.connections - a.connections);
    const limitedNodes = sortedNodes.slice(0, maxNodes);
    const limitedNodeIds = new Set(limitedNodes.map(n => n.id));
    const limitedLinks = allLinks.filter(l => limitedNodeIds.has(l.source) && limitedNodeIds.has(l.target));
    const isLimited = allNodes.length > maxNodes;

    // Collect unique layers/modules from limited nodes
    const uniqueLayers = [...new Set(limitedNodes.map(n => n.layer))];

    // Build dynamic color map for legend and D3
    const colorMap: Record<string, string> = useModuleColoring
      ? moduleColorMap
      : { API: '#ec4899', Service: '#3b82f6', Data: '#10b981', UI: '#f59e0b', Infrastructure: '#8b5cf6', Other: '#64748b' };

    const legendLabel = useModuleColoring ? 'Colored by module' : 'Colored by layer';

    const legendHtml = uniqueLayers.map(l => {
      const color = colorMap[l] || '#64748b';
      return `<span class="legend-item"><span class="legend-dot" style="background: ${color}"></span> ${l}</span>`;
    }).join('');

    const filterHtml = uniqueLayers.map(l => {
      const color = colorMap[l] || '#64748b';
      return `<label class="graph-filter-check"><input type="checkbox" checked data-layer="${l}" onchange="toggleGraphLayer('${l}', this.checked)"><span class="legend-dot" style="background: ${color}"></span> ${l}</label>`;
    }).join('');

    return `
<h2 class="section-title">🔗 Dependency Graph</h2>
<div class="card graph-card">
  <div class="graph-controls">
    <div class="graph-legend">
      <span class="legend-label" style="color:#94a3b8;font-size:11px;margin-right:8px;">${legendLabel}:</span>
      ${legendHtml}
    </div>
    <div class="graph-filters">
      <input type="text" id="graphSearch" class="graph-search" placeholder="🔍 Search node..." oninput="filterGraphNodes(this.value)">
      <div class="graph-layer-filters">
        ${filterHtml}
      </div>
    </div>
    ${isLimited ? `<div class="graph-limit-notice">Showing top ${maxNodes} of ${allNodes.length} source files (most connected) · ${limitedLinks.length} links</div>` : ''}
  </div>
  <div id="dep-graph" style="width:100%; min-height:500px;"></div>
  <div class="graph-hint">🖱️ Drag nodes • Scroll to zoom • Double-click to reset • Node size = connections</div>
</div>
<script type="application/json" id="graph-nodes">${JSON.stringify(limitedNodes)}${'</'+'script>'}
<script type="application/json" id="graph-links">${JSON.stringify(limitedLinks)}${'</'+'script>'}
<script type="application/json" id="graph-colors">${JSON.stringify(colorMap)}${'</'+'script>'}`;
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
  <p>Generated by <a href="https://github.com/camilooscargbaptista/architect">⚡ Architect v3.0</a> — Enterprise Architecture Intelligence</p>
  <p>By <strong>Camilo Girardelli</strong> · <a href="https://www.girardellitecnologia.com">Girardelli Tecnologia</a></p>
</div>`;
  }

  // ── Refactoring Plan Section ──

  private opColor(type: string): string {
    switch (type) {
      case 'CREATE': return '#22c55e';
      case 'MOVE': return '#3b82f6';
      case 'MODIFY': return '#f59e0b';
      case 'DELETE': return '#ef4444';
      default: return '#64748b';
    }
  }

  private opIcon(type: string): string {
    switch (type) {
      case 'CREATE': return '➕';
      case 'MOVE': return '📦';
      case 'MODIFY': return '✏️';
      case 'DELETE': return '🗑️';
      default: return '📄';
    }
  }

  private renderRefactoringPlan(plan: RefactoringPlan): string {
    if (plan.steps.length === 0) {
      return `
<h2 class="section-title">✅ Refactoring Plan</h2>
<div class="card success-card">
  <p>No refactoring needed! Your architecture is already in great shape.</p>
</div>`;
    }

    const improvement = plan.estimatedScoreAfter.overall - plan.currentScore.overall;

    const metrics = Object.keys(plan.currentScore.breakdown) as Array<keyof typeof plan.currentScore.breakdown>;
    const bars = metrics.map(metric => {
      const before = plan.currentScore.breakdown[metric];
      const after = plan.estimatedScoreAfter.breakdown[metric] ?? before;
      const diff = after - before;
      return `
      <div class="comparison-row">
        <div class="refactor-metric-name">${metric}</div>
        <div class="refactor-metric-bars">
          <div class="rbar-before" style="width: ${before}%; background: ${this.scoreColor(before)}40"><span>${before}</span></div>
          <div class="rbar-after" style="width: ${after}%; background: ${this.scoreColor(after)}"><span>${after}</span></div>
        </div>
        <div class="refactor-metric-diff" style="color: ${diff > 0 ? '#22c55e' : '#64748b'}">
          ${diff > 0 ? `+${diff}` : diff === 0 ? '—' : String(diff)}
        </div>
      </div>`;
    }).join('');

    const stepsHtml = plan.steps.map(step => this.renderRefactorStep(step)).join('');

    const criticalCount = plan.steps.filter(s => s.priority === 'CRITICAL').length;
    const highCount = plan.steps.filter(s => s.priority === 'HIGH').length;
    const mediumCount = plan.steps.filter(s => s.priority === 'MEDIUM').length;
    const lowCount = plan.steps.filter(s => s.priority === 'LOW').length;

    return `
<h2 class="section-title">🔧 Refactoring Plan</h2>

<div class="card refactor-score">
  <div class="refactor-score-pair">
    <div class="rscore-box">
      <div class="rscore-num" style="color: ${this.scoreColor(plan.currentScore.overall)}">${plan.currentScore.overall}</div>
      <div class="rscore-label">Current</div>
    </div>
    <div class="rscore-arrow">
      <svg width="60" height="30" viewBox="0 0 60 30">
        <path d="M5 15 L45 15 M40 8 L48 15 L40 22" stroke="#818cf8" stroke-width="2.5" fill="none"/>
      </svg>
    </div>
    <div class="rscore-box">
      <div class="rscore-num" style="color: ${this.scoreColor(plan.estimatedScoreAfter.overall)}">${plan.estimatedScoreAfter.overall}</div>
      <div class="rscore-label">Estimated</div>
    </div>
    <div class="rscore-improvement" style="color: #22c55e">+${improvement} pts</div>
  </div>
  <div class="refactor-bars-section">
    <div class="refactor-legend">
      <span class="rlegend-tag rbefore">Before</span>
      <span class="rlegend-tag rafter">After</span>
    </div>
    ${bars}
  </div>
</div>

<div class="refactor-stats-row">
  <div class="rstat">${plan.steps.length} steps</div>
  <div class="rstat">${plan.totalOperations} operations</div>
  <div class="rstat">Tier 1: ${plan.tier1Steps}</div>
  <div class="rstat">Tier 2: ${plan.tier2Steps}</div>
</div>

<div class="priority-bar">
  ${criticalCount ? `<div class="prio-seg prio-critical" style="flex: ${criticalCount}">🔴 ${criticalCount}</div>` : ''}
  ${highCount ? `<div class="prio-seg prio-high" style="flex: ${highCount}">🟠 ${highCount}</div>` : ''}
  ${mediumCount ? `<div class="prio-seg prio-medium" style="flex: ${mediumCount}">🔵 ${mediumCount}</div>` : ''}
  ${lowCount ? `<div class="prio-seg prio-low" style="flex: ${lowCount}">🟢 ${lowCount}</div>` : ''}
</div>

<div class="refactor-roadmap">
  ${stepsHtml}
</div>`;
  }

  private renderRefactorStep(step: RefactorStep): string {
    const operationsHtml = step.operations.map(op => `
      <div class="rop">
        <span class="rop-icon">${this.opIcon(op.type)}</span>
        <span class="rop-badge" style="background: ${this.opColor(op.type)}20; color: ${this.opColor(op.type)}; border: 1px solid ${this.opColor(op.type)}40">${op.type}</span>
        <code class="rop-path">${this.escapeHtml(op.path)}</code>
        ${op.newPath ? `<span class="rop-arrow">→</span> <code class="rop-path">${this.escapeHtml(op.newPath)}</code>` : ''}
        <div class="rop-desc">${this.escapeHtml(op.description)}</div>
      </div>
    `).join('');

    const impactHtml = step.scoreImpact.map(i =>
      `<span class="rimpact-tag">${i.metric}: ${i.before}→${i.after} <strong>+${i.after - i.before}</strong></span>`
    ).join('');

    return `
<div class="rstep-card">
  <div class="rstep-header">
    <div class="rstep-number">${step.id}</div>
    <div class="rstep-info">
      <div class="rstep-title-row">
        <h3>${this.escapeHtml(step.title)}</h3>
        <span class="severity-badge severity-${step.priority}">${step.priority}</span>
        <span class="tier-badge">Tier ${step.tier}</span>
      </div>
      <p class="rstep-desc">${this.escapeHtml(step.description)}</p>
      <details class="rstep-details">
        <summary>📖 Why?</summary>
        <p class="rstep-rationale">${this.escapeHtml(step.rationale)}</p>
      </details>
    </div>
  </div>
  <details class="rstep-ops-accordion">
    <summary class="rstep-ops-toggle">📋 Operations (${step.operations.length})</summary>
    <div class="rstep-ops">
      ${operationsHtml}
    </div>
  </details>
  <div class="rstep-impact">
    <h4>📈 Score Impact</h4>
    <div class="rimpact-tags">${impactHtml}</div>
  </div>
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

  // ── Sidebar Active Section Tracking ──
  const sectionIds = ['score', 'layers', 'anti-patterns', 'suggestions', 'refactoring', 'agents'];
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        const link = document.querySelector('.sidebar-link[data-section="' + entry.target.id + '"]');
        if (link) link.classList.add('active');
      }
    });
  }, { threshold: 0.15, rootMargin: '-80px 0px -60% 0px' });

  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });
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
  const height = 500;
  container.style.height = height + 'px';

  // Dynamic color map — loaded from JSON (supports both layer and module coloring)
  const colorsEl = document.getElementById('graph-colors');
  const layerColors = colorsEl ? JSON.parse(colorsEl.textContent || '{}') : {
    API: '#ec4899', Service: '#3b82f6', Data: '#10b981',
    UI: '#f59e0b', Infrastructure: '#8b5cf6', Other: '#64748b',
  };

  const svg = d3.select('#dep-graph').append('svg')
    .attr('width', width).attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  // Zoom container
  const g = svg.append('g');

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.2, 5])
    .on('zoom', (event) => { g.attr('transform', event.transform); });
  svg.call(zoom);

  // Double-click to reset zoom
  svg.on('dblclick.zoom', () => {
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  });

  // Arrow marker
  g.append('defs').append('marker')
    .attr('id', 'arrowhead').attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20).attr('refY', 0).attr('orient', 'auto')
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .append('path').attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', '#475569');

  // Tuned simulation for better spread
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05))
    .force('collision', d3.forceCollide().radius(d => Math.max(d.connections * 2 + 16, 20)));

  const link = g.append('g')
    .selectAll('line').data(links).join('line')
    .attr('stroke', '#334155').attr('stroke-width', 1)
    .attr('stroke-opacity', 0.4).attr('marker-end', 'url(#arrowhead)');

  const node = g.append('g')
    .selectAll('g').data(nodes).join('g')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  // Node circles — color by layer
  node.append('circle')
    .attr('r', d => Math.max(d.connections * 2.5 + 5, 6))
    .attr('fill', d => layerColors[d.layer] || '#64748b')
    .attr('stroke', '#0f172a').attr('stroke-width', 1.5)
    .attr('opacity', 0.9);

  // Node labels — only show for nodes with enough connections
  node.filter(d => d.connections >= 2).append('text')
    .text(d => d.name.replace(/\\.[^.]+$/, ''))
    .attr('x', 0).attr('y', d => -(Math.max(d.connections * 2.5 + 5, 6) + 4))
    .attr('text-anchor', 'middle')
    .attr('fill', '#e2e8f0').attr('font-size', '9px').attr('font-weight', '500');

  // Tooltip
  node.append('title')
    .text(d => d.id + '\\nConnections: ' + d.connections + '\\nLayer: ' + d.layer);

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
  });

  // Expose search and filter functions
  window.filterGraphNodes = function(query) {
    if (!query) {
      node.attr('opacity', 1);
      link.attr('opacity', 0.4);
      return;
    }
    query = query.toLowerCase();
    node.attr('opacity', d => d.id.toLowerCase().includes(query) || d.name.toLowerCase().includes(query) ? 1 : 0.1);
    link.attr('opacity', d => {
      const srcMatch = d.source.id.toLowerCase().includes(query);
      const tgtMatch = d.target.id.toLowerCase().includes(query);
      return (srcMatch || tgtMatch) ? 0.6 : 0.05;
    });
  };

  window.toggleGraphLayer = function(layer, visible) {
    node.filter(d => d.layer === layer)
      .transition().duration(300)
      .attr('opacity', visible ? 1 : 0.05);
    link.filter(d => d.source.layer === layer || d.target.layer === layer)
      .transition().duration(300)
      .attr('opacity', visible ? 0.4 : 0.02);
  };
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


  private renderAgentSuggestions(s: AgentSuggestion): string {
    const roleIcon = (name: string): string => {
      if (name.includes('ORCHESTRATOR')) return '\u{1F3AD}';
      if (name.includes('BACKEND') || name.includes('FRONTEND') || name.includes('DATABASE') || name.includes('FLUTTER')) return '\u{1F4BB}';
      if (name.includes('SECURITY')) return '\u{1F6E1}\uFE0F';
      if (name.includes('QA')) return '\u{1F9EA}';
      if (name.includes('TECH-DEBT')) return '\u{1F4CA}';
      return '\u{1F916}';
    };

    const roleLabel = (name: string): string => {
      if (name.includes('ORCHESTRATOR')) return 'coordination';
      if (name.includes('SECURITY')) return 'protection';
      if (name.includes('QA')) return 'quality';
      if (name.includes('TECH-DEBT')) return 'governance';
      return 'development';
    };

    const roleColor = (name: string): string => {
      if (name.includes('ORCHESTRATOR')) return '#c084fc';
      if (name.includes('SECURITY')) return '#f87171';
      if (name.includes('QA')) return '#34d399';
      if (name.includes('TECH-DEBT')) return '#fbbf24';
      return '#60a5fa';
    };

    // Status helpers
    const statusBadge = (status: string): string => {
      const map: Record<string, { icon: string; label: string; color: string }> = {
        'KEEP': { icon: '✅', label: 'KEEP', color: '#22c55e' },
        'MODIFY': { icon: '🔵', label: 'MODIFY', color: '#3b82f6' },
        'CREATE': { icon: '🟡', label: 'NEW', color: '#f59e0b' },
        'DELETE': { icon: '🔴', label: 'REMOVE', color: '#ef4444' },
      };
      const s = map[status] || map['CREATE'];
      return `<span class="agent-status-badge" style="background:${s.color}20;color:${s.color};border:1px solid ${s.color}40">${s.icon} ${s.label}</span>`;
    };

    const statusBorder = (status: string): string => {
      const map: Record<string, string> = {
        'KEEP': '#22c55e', 'MODIFY': '#3b82f6', 'CREATE': '#f59e0b', 'DELETE': '#ef4444',
      };
      return map[status] || '#334155';
    };

    const agentCards = s.suggestedAgents.map(a =>
      `<label class="agent-toggle-card" data-category="agents" data-name="${a.name}">
        <input type="checkbox" class="agent-check" ${a.status !== 'DELETE' ? 'checked' : ''} data-type="agents" data-item="${a.name}">
        <div class="agent-toggle-inner" style="border-color:${statusBorder(a.status)}">
          <div class="agent-toggle-icon">${roleIcon(a.name)}</div>
          <div class="agent-toggle-info">
            <span class="agent-toggle-name">${a.name}</span>
            <span class="agent-toggle-role" style="color:${roleColor(a.name)}">${roleLabel(a.name)}</span>
            ${a.description ? `<span class="agent-toggle-desc">${a.description}</span>` : ''}
          </div>
          ${statusBadge(a.status)}
          <div class="agent-toggle-check">\u2713</div>
        </div>
      </label>`
    ).join('\n');

    const miniCard = (item: { name: string; status: string; description?: string }, icon: string, type: string): string =>
      `<label class="agent-toggle-card mini" data-category="${type}">
        <input type="checkbox" class="agent-check" ${item.status !== 'DELETE' ? 'checked' : ''} data-type="${type}" data-item="${item.name}">
        <div class="agent-toggle-inner" style="border-color:${statusBorder(item.status)}">
          <span class="agent-toggle-icon">${icon}</span>
          <div class="agent-toggle-info">
            <span class="agent-toggle-name">${item.name}.md</span>
            ${item.description ? `<span class="agent-toggle-desc">${item.description}</span>` : ''}
          </div>
          ${statusBadge(item.status)}
          <div class="agent-toggle-check">\u2713</div>
        </div>
      </label>`;

    const ruleCards = s.suggestedRules.map(r => miniCard(r, '\u{1F4CF}', 'rules')).join('\n');
    const guardCards = s.suggestedGuards.map(g => miniCard(g, '\u{1F6E1}\uFE0F', 'guards')).join('\n');
    const workflowCards = s.suggestedWorkflows.map(w => miniCard(w, '\u26A1', 'workflows')).join('\n');

    const skillCards = s.suggestedSkills.map(sk =>
      `<label class="agent-toggle-card" data-category="skills">
        <input type="checkbox" class="agent-check" checked data-type="skills" data-item="${sk.source}">
        <div class="agent-toggle-inner" style="border-color:${statusBorder(sk.status)}">
          <span class="agent-toggle-icon">\u{1F9E0}</span>
          <div class="agent-toggle-info">
            <span class="agent-toggle-name">${sk.name}</span>
            <span class="agent-toggle-role" style="color:#34d399">${sk.description}</span>
          </div>
          ${statusBadge(sk.status)}
          <div class="agent-toggle-check">\u2713</div>
        </div>
      </label>`
    ).join('\n');

    const auditSection = s.audit.filter(f => f.type !== 'OK').length > 0 ? `
    <div class="agent-audit-section">
      <h3 class="agent-section-subtitle">\u{1F50D} Audit Findings</h3>
      <div class="agent-audit-grid">
        ${s.audit.filter(f => f.type !== 'OK').map(f => {
          const icon = f.type === 'MISSING' ? '\u274C' : f.type === 'IMPROVEMENT' ? '\u{1F4A1}' : '\u26A0\uFE0F';
          const cls = f.type === 'MISSING' ? 'audit-missing' : 'audit-improvement';
          return `<div class="agent-audit-item ${cls}">
            <span class="audit-icon">${icon}</span>
            <div class="audit-content">
              <span class="audit-desc">${f.description}</span>
              ${f.suggestion ? `<span class="audit-suggestion">\u2192 ${f.suggestion}</span>` : ''}
            </div>
          </div>`;
        }).join('\n')}
      </div>
    </div>` : '';

    const stackPills = [
      `\u{1F527} ${s.stack.primary}`,
      `\u{1F4E6} ${s.stack.frameworks.length > 0 ? s.stack.frameworks.join(', ') : 'No framework'}`,
      s.hasExistingAgents ? '\u{1F4C1} Existing .agent/' : '\u{1F4C1} New .agent/',
      ...(s.stack.hasBackend ? ['\u{1F519} Backend'] : []),
      ...(s.stack.hasFrontend ? ['\u{1F5A5}\uFE0F Frontend'] : []),
      ...(s.stack.hasMobile ? ['\u{1F4F1} Mobile'] : []),
      ...(s.stack.hasDatabase ? ['\u{1F5C4}\uFE0F Database'] : []),
    ];

    const totalItems = s.suggestedAgents.length + s.suggestedRules.length + s.suggestedGuards.length + s.suggestedWorkflows.length + s.suggestedSkills.length;

    // Status summary counts
    const allItems = [...s.suggestedAgents, ...s.suggestedRules, ...s.suggestedGuards, ...s.suggestedWorkflows];
    const keepCount = allItems.filter(i => i.status === 'KEEP').length;
    const modifyCount = allItems.filter(i => i.status === 'MODIFY').length;
    const createCount = allItems.filter(i => i.status === 'CREATE').length;

    return `
<h2 class="section-title">\u{1F916} Agent System</h2>

<div class="card agent-system-card">
  <div class="agent-stack-banner">
    ${stackPills.map(p => `<div class="stack-pill">${p}</div>`).join('\n    ')}
  </div>

  <div class="agent-status-legend">
    <span class="status-legend-item"><span class="legend-dot" style="background:#22c55e"></span> KEEP (${keepCount})</span>
    <span class="status-legend-item"><span class="legend-dot" style="background:#3b82f6"></span> MODIFY (${modifyCount})</span>
    <span class="status-legend-item"><span class="legend-dot" style="background:#f59e0b"></span> NEW (${createCount})</span>
  </div>

  <div class="agent-controls">
    <button class="agent-ctrl-btn" onclick="toggleAll(true)">\u2705 Select All</button>
    <button class="agent-ctrl-btn" onclick="toggleAll(false)">\u2B1C Select None</button>
    <span class="agent-count-label"><span id="agentSelectedCount">${totalItems}</span> selected</span>
  </div>

  <h3 class="agent-section-subtitle">\u{1F916} Agents</h3>
  <div class="agent-toggle-grid">
    ${agentCards}
  </div>

  <div class="agent-extras-grid">
    <div>
      <h3 class="agent-section-subtitle">\u{1F4CF} Rules</h3>
      <div class="agent-toggle-list">${ruleCards}</div>
    </div>
    <div>
      <h3 class="agent-section-subtitle">\u{1F6E1}\uFE0F Guards</h3>
      <div class="agent-toggle-list">${guardCards}</div>
    </div>
    <div>
      <h3 class="agent-section-subtitle">\u26A1 Workflows</h3>
      <div class="agent-toggle-list">${workflowCards}</div>
    </div>
  </div>

  <h3 class="agent-section-subtitle">\u{1F9E0} Skills <span style="font-size:0.7rem;color:#94a3b8;font-weight:400">from skills.sh</span></h3>
  <div class="agent-toggle-grid">
    ${skillCards}
  </div>

  ${auditSection}

  <div class="agent-command-box">
    <div class="agent-command-header">
      <span>\u{1F4A1} Command to generate selected items:</span>
      <button class="agent-copy-btn" onclick="copyAgentCommand()">
        <span id="copyIcon">\u{1F4CB}</span> Copy
      </button>
    </div>
    <code id="agentCommandOutput" class="agent-command-code">${s.command}</code>
  </div>
</div>

<style>
  .agent-system-card { padding: 1.5rem; }
  .agent-stack-banner { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .stack-pill { background: #1e293b; border: 1px solid #334155; border-radius: 99px; padding: 0.4rem 1rem; font-size: 0.8rem; color: #94a3b8; white-space: nowrap; }
  .agent-status-legend { display: flex; gap: 1.5rem; margin-bottom: 1rem; padding: 0.5rem 0; border-bottom: 1px solid #1e293b; }
  .status-legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: #94a3b8; }
  .agent-status-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.65rem; font-weight: 700; flex-shrink: 0; letter-spacing: 0.03em; }
  .agent-toggle-desc { display: block; font-size: 0.65rem; color: #64748b; margin-top: 0.15rem; line-height: 1.3; }
  .agent-controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
  .agent-ctrl-btn { background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
  .agent-ctrl-btn:hover { background: #334155; }
  .agent-count-label { color: #94a3b8; font-size: 0.85rem; margin-left: auto; }
  #agentSelectedCount { color: #c084fc; font-weight: 700; }
  .agent-section-subtitle { color: #e2e8f0; font-size: 1.05rem; font-weight: 700; margin: 1.25rem 0 0.75rem; }
  .agent-toggle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }
  .agent-toggle-card { cursor: pointer; transition: all 0.3s; }
  .agent-toggle-card input { display: none; }
  .agent-toggle-inner { display: flex; align-items: center; gap: 0.75rem; background: #1e293b; border: 2px solid #334155; border-radius: 12px; padding: 0.75rem 1rem; transition: all 0.3s; }
  .agent-toggle-card input:checked + .agent-toggle-inner { background: #1e1b4b; }
  .agent-toggle-icon { font-size: 1.3rem; flex-shrink: 0; }
  .agent-toggle-info { flex: 1; min-width: 0; }
  .agent-toggle-name { display: block; color: #e2e8f0; font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .agent-toggle-role { display: block; font-size: 0.7rem; margin-top: 0.15rem; }
  .agent-toggle-check { color: #334155; font-size: 1rem; flex-shrink: 0; transition: color 0.3s; }
  .agent-toggle-card input:checked + .agent-toggle-inner .agent-toggle-check { color: #818cf8; }
  .agent-toggle-card.mini .agent-toggle-inner { padding: 0.5rem 0.75rem; border-radius: 8px; }
  .agent-extras-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 0.5rem; }
  @media (max-width: 768px) { .agent-extras-grid { grid-template-columns: 1fr; } }
  .agent-toggle-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .agent-audit-section { margin-top: 1.5rem; }
  .agent-audit-grid { display: flex; flex-direction: column; gap: 0.5rem; }
  .agent-audit-item { display: flex; gap: 0.75rem; align-items: flex-start; background: #1e293b; padding: 0.75rem 1rem; border-radius: 8px; }
  .agent-audit-item.audit-missing { border-left: 3px solid #ef4444; }
  .agent-audit-item.audit-improvement { border-left: 3px solid #fbbf24; }
  .audit-icon { font-size: 1rem; flex-shrink: 0; margin-top: 2px; }
  .audit-content { display: flex; flex-direction: column; gap: 0.25rem; }
  .audit-desc { color: #e2e8f0; font-size: 0.85rem; }
  .audit-suggestion { color: #94a3b8; font-size: 0.8rem; font-style: italic; }
  .agent-command-box { margin-top: 1.5rem; background: #0f172a; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
  .agent-command-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #1e293b; font-size: 0.8rem; color: #94a3b8; }
  .agent-copy-btn { background: #c084fc; color: #0f172a; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s; }
  .agent-copy-btn:hover { background: #a855f7; transform: scale(1.05); }
  .agent-command-code { display: block; padding: 1rem; color: #c084fc; font-size: 0.85rem; word-break: break-all; font-family: 'Fira Code', monospace; }
</style>

<script>
(function() {
  var basePath = ${JSON.stringify(s.command.replace('architect agents ', ''))};
  var totalItems = ${totalItems};
  function updateCommand() {
    var checks = document.querySelectorAll('.agent-check');
    var selected = { agents: [], rules: [], guards: [], workflows: [], skills: [] };
    var count = 0;
    checks.forEach(function(cb) { if (cb.checked) { selected[cb.dataset.type].push(cb.dataset.item); count++; } });
    document.getElementById('agentSelectedCount').textContent = count;
    var cmd;
    if (count === totalItems) { cmd = 'architect agents ' + basePath; }
    else if (count === 0) { cmd = '# No items selected'; }
    else {
      var parts = ['architect agents ' + basePath];
      if (selected.agents.length > 0) parts.push('--agents ' + selected.agents.join(','));
      if (selected.rules.length > 0) parts.push('--rules ' + selected.rules.join(','));
      if (selected.guards.length > 0) parts.push('--guards ' + selected.guards.join(','));
      if (selected.workflows.length > 0) parts.push('--workflows ' + selected.workflows.join(','));
      if (selected.skills.length > 0) parts.push('&& ' + selected.skills.map(function(sk){ return 'npx skills add ' + sk; }).join(' && '));
      cmd = parts.join(' ');
    }
    document.getElementById('agentCommandOutput').textContent = cmd;
  }
  document.querySelectorAll('.agent-check').forEach(function(cb) { cb.addEventListener('change', updateCommand); });
  window.toggleAll = function(state) { document.querySelectorAll('.agent-check').forEach(function(cb) { cb.checked = state; }); updateCommand(); };
  window.copyAgentCommand = function() { var cmd = document.getElementById('agentCommandOutput').textContent; navigator.clipboard.writeText(cmd).then(function() { var btn = document.getElementById('copyIcon'); btn.textContent = '\u2705'; setTimeout(function() { btn.textContent = '\ud83d\udccb'; }, 2000); }); };
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

  html { scroll-behavior: smooth; }

  /* ── Layout ── */
  .report-layout { display: flex; min-height: 100vh; }

  .sidebar {
    position: sticky; top: 0; height: 100vh; width: 220px; min-width: 220px;
    background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
    border-right: 1px solid #334155; padding: 1.5rem 0;
    display: flex; flex-direction: column; gap: 0.25rem;
    overflow-y: auto; z-index: 100;
  }
  .sidebar-title {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.15em; color: #475569; padding: 0 1.25rem; margin-bottom: 0.75rem;
  }
  .sidebar-link {
    display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.25rem;
    color: #94a3b8; text-decoration: none; font-size: 0.8rem; font-weight: 500;
    border-left: 3px solid transparent; transition: all 0.2s;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sidebar-link:hover { color: #e2e8f0; background: #1e293b; border-left-color: #475569; }
  .sidebar-link.active { color: #c084fc; background: #c084fc10; border-left-color: #c084fc; font-weight: 700; }

  .sidebar-toggle {
    display: none; position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 200;
    width: 48px; height: 48px; border-radius: 50%; border: none;
    background: #c084fc; color: #0f172a; font-size: 1.2rem; cursor: pointer;
    box-shadow: 0 4px 16px rgba(192,132,252,0.4); transition: all 0.2s;
  }
  .sidebar-toggle:hover { transform: scale(1.1); }

  @media (max-width: 1024px) {
    .sidebar {
      position: fixed; left: -240px; top: 0; width: 240px; min-width: 240px;
      transition: left 0.3s ease; box-shadow: none;
    }
    .sidebar.sidebar-open { left: 0; box-shadow: 4px 0 24px rgba(0,0,0,0.5); }
    .sidebar-toggle { display: flex; align-items: center; justify-content: center; }
    .report-layout { flex-direction: column; }
  }

  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; flex: 1; min-width: 0; }

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

  /* ── Section Accordion ── */
  .section-accordion {
    margin: 1.5rem 0; border: 1px solid #334155; border-radius: 16px;
    background: transparent; overflow: hidden;
  }
  .section-accordion-header {
    cursor: pointer; list-style: none; display: flex; align-items: center; gap: 0.75rem;
    font-size: 1.3rem; font-weight: 700; color: #e2e8f0;
    padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #1e293b, #0f172a);
    border-bottom: 1px solid transparent; transition: all 0.3s; user-select: none;
  }
  .section-accordion-header:hover { background: linear-gradient(135deg, #334155, #1e293b); }
  .section-accordion[open] > .section-accordion-header { border-bottom-color: #334155; }
  .section-accordion-header::after {
    content: '\\25B6'; margin-left: auto; font-size: 0.8rem; color: #818cf8;
    transition: transform 0.3s;
  }
  .section-accordion[open] > .section-accordion-header::after { transform: rotate(90deg); }
  .section-accordion-header::-webkit-details-marker { display: none; }
  .section-accordion-body { padding: 0.5rem 0; }

  /* ── Project Overview ── */
  .overview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .overview-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 1.25rem;
  }
  .overview-main {
    grid-column: 1 / -1;
    background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08));
    border-color: #3b82f6;
  }
  .overview-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin-bottom: 0.75rem;
  }
  .overview-description {
    font-size: 1.1rem;
    color: #e2e8f0;
    line-height: 1.6;
    margin-bottom: 0.75rem;
  }
  .overview-purpose-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .overview-purpose-label {
    font-size: 0.8rem;
    color: #64748b;
  }
  .overview-purpose-value {
    font-size: 0.85rem;
    color: #a78bfa;
    font-weight: 600;
    background: rgba(139,92,246,0.1);
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
  }
  .overview-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .overview-tag {
    font-size: 0.75rem;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-weight: 500;
  }
  .tech-tag {
    background: rgba(59,130,246,0.15);
    color: #60a5fa;
    border: 1px solid rgba(59,130,246,0.3);
  }
  .keyword-tag {
    background: rgba(16,185,129,0.1);
    color: #34d399;
    border: 1px solid rgba(16,185,129,0.2);
  }
  .overview-entry {
    font-size: 0.8rem;
    background: rgba(255,255,255,0.05);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    color: #e2e8f0;
    font-family: 'SF Mono', monospace;
  }
  .overview-entries {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .overview-modules-section {
    margin-top: 0.5rem;
  }
  .overview-modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
  .overview-module {
    background: rgba(255,255,255,0.03);
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    transition: border-color 0.2s;
  }
  .overview-module:hover {
    border-color: #3b82f6;
  }
  .overview-module-name {
    font-weight: 600;
    color: #e2e8f0;
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
  }
  .overview-module-desc {
    color: #94a3b8;
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
  }
  .overview-module-files {
    color: #64748b;
    font-size: 0.7rem;
  }
  .overview-empty {
    color: #475569;
    font-size: 0.85rem;
    font-style: italic;
  }
  @media (max-width: 768px) {
    .overview-grid { grid-template-columns: 1fr; }
  }

  /* ── Operations Accordion (inside refactoring steps) ── */
  .rstep-ops-accordion {
    margin: 0.75rem 0; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden;
  }
  .rstep-ops-toggle {
    cursor: pointer; list-style: none; display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.9rem; font-weight: 600; color: #94a3b8;
    padding: 0.75rem 1rem; background: #0f172a; transition: all 0.2s;
  }
  .rstep-ops-toggle:hover { background: #1e293b; color: #e2e8f0; }
  .rstep-ops-toggle::after {
    content: '\\25B6'; margin-left: auto; font-size: 0.65rem; color: #818cf8;
    transition: transform 0.3s;
  }
  .rstep-ops-accordion[open] > .rstep-ops-toggle::after { transform: rotate(90deg); }
  .rstep-ops-toggle::-webkit-details-marker { display: none; }

  /* ── Cards ── */
  .card {
    background: #1e293b; border-radius: 16px; border: 1px solid #334155;
    padding: 1.5rem; margin-bottom: 1rem; overflow-x: auto;
  }
  .success-card { border-color: #22c55e40; color: #22c55e; text-align: center; padding: 2rem; font-size: 1.1rem; }

  /* ── Graph ── */
  .graph-card { padding: 1rem; }
  .graph-controls { margin-bottom: 0.75rem; }
  .graph-legend {
    display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;
    justify-content: center;
  }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #94a3b8; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .graph-filters {
    display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;
    justify-content: center; margin-top: 0.5rem;
  }
  .graph-search {
    background: #0f172a; border: 1px solid #334155; border-radius: 8px;
    padding: 0.4rem 0.75rem; color: #e2e8f0; font-size: 0.8rem;
    outline: none; width: 180px; transition: border-color 0.2s;
  }
  .graph-search:focus { border-color: #818cf8; }
  .graph-layer-filters {
    display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;
  }
  .graph-filter-check {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.75rem; color: #94a3b8; cursor: pointer;
  }
  .graph-filter-check input { width: 14px; height: 14px; accent-color: #818cf8; }
  .graph-limit-notice {
    text-align: center; font-size: 0.75rem; color: #f59e0b;
    background: #f59e0b15; padding: 0.3rem 0.75rem; border-radius: 6px;
    margin-top: 0.5rem;
  }
  .graph-hint {
    text-align: center; font-size: 0.75rem; color: #475569; margin-top: 0.5rem;
    font-style: italic;
  }
  #dep-graph svg { background: rgba(0,0,0,0.2); border-radius: 12px; cursor: grab; }
  #dep-graph svg:active { cursor: grabbing; }

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

  /* ── Refactoring Plan ── */
  .refactor-score { padding: 2rem; }
  .refactor-score-pair {
    display: flex; align-items: center; justify-content: center; gap: 1.5rem;
    margin-bottom: 2rem; flex-wrap: wrap;
  }
  .rscore-box { text-align: center; }
  .rscore-num { font-size: 3rem; font-weight: 900; line-height: 1; }
  .rscore-label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .rscore-improvement { font-size: 1.3rem; font-weight: 700; }

  .refactor-legend { display: flex; gap: 1rem; margin-bottom: 0.5rem; }
  .rlegend-tag { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 6px; }
  .rlegend-tag.rbefore { background: rgba(255,255,255,0.05); color: #94a3b8; }
  .rlegend-tag.rafter { background: rgba(129,140,248,0.2); color: #818cf8; }

  .refactor-metric-name { width: 100px; font-size: 0.8rem; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .refactor-metric-bars { flex: 1; position: relative; height: 30px; }
  .rbar-before, .rbar-after {
    position: absolute; left: 0; height: 14px; border-radius: 4px;
    display: flex; align-items: center; padding-left: 6px;
    font-size: 0.7rem; font-weight: 600;
  }
  .rbar-before { top: 0; }
  .rbar-after { top: 15px; }
  .refactor-metric-diff { width: 50px; text-align: right; font-weight: 700; font-size: 0.85rem; }

  .refactor-stats-row {
    display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;
  }
  .rstat {
    background: #1e293b; border: 1px solid #334155; border-radius: 99px;
    padding: 0.4rem 1rem; font-size: 0.85rem; color: #94a3b8; font-weight: 500;
  }

  .priority-bar {
    display: flex; border-radius: 12px; overflow: hidden; height: 32px; margin-bottom: 2rem;
  }
  .prio-seg {
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 600;
  }
  .prio-critical { background: #ef444430; color: #ef4444; }
  .prio-high { background: #f59e0b30; color: #f59e0b; }
  .prio-medium { background: #3b82f630; color: #60a5fa; }
  .prio-low { background: #22c55e30; color: #22c55e; }

  .refactor-roadmap { display: flex; flex-direction: column; gap: 1rem; }
  .rstep-card {
    background: #1e293b; border-radius: 16px; border: 1px solid #334155;
    padding: 1.5rem; transition: border-color 0.2s;
  }
  .rstep-card:hover { border-color: #818cf8; }
  .rstep-header { display: flex; gap: 1rem; margin-bottom: 1rem; }
  .rstep-number {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(135deg, #818cf8, #c084fc);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 1rem; color: white; flex-shrink: 0;
  }
  .rstep-info { flex: 1; }
  .rstep-title-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .rstep-title-row h3 { font-size: 1.1rem; font-weight: 700; }
  .rstep-desc { color: #94a3b8; font-size: 0.9rem; margin-top: 0.3rem; }
  .tier-badge {
    background: #818cf815; color: #818cf8; border: 1px solid #818cf830;
    padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.65rem; font-weight: 600;
  }
  .rstep-details { margin-top: 0.5rem; }
  .rstep-details summary { cursor: pointer; color: #818cf8; font-size: 0.85rem; font-weight: 500; }
  .rstep-rationale { color: #64748b; font-size: 0.85rem; margin-top: 0.3rem; font-style: italic; }

  .rstep-ops { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #334155; }
  .rstep-ops h4 { font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem; }
  .rop { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .rop-icon { font-size: 0.9rem; }
  .rop-badge { padding: 0.1rem 0.4rem; border-radius: 6px; font-size: 0.65rem; font-weight: 700; }
  .rop-path { background: #0f172a; padding: 1px 6px; border-radius: 4px; font-size: 0.8rem; color: #c084fc; }
  .rop-arrow { color: #818cf8; font-weight: 700; }
  .rop-desc { width: 100%; color: #64748b; font-size: 0.8rem; padding-left: 1.8rem; }

  .rstep-impact { margin-top: 0.5rem; }
  .rstep-impact h4 { font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.3rem; }
  .rimpact-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .rimpact-tag {
    background: #22c55e10; color: #22c55e; border: 1px solid #22c55e30;
    padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.75rem; font-weight: 500;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .score-hero { flex-direction: column; gap: 1.5rem; }
    .score-breakdown { grid-template-columns: 1fr; }
    .header h1 { font-size: 1.8rem; }
    .container { padding: 1rem; }
    .refactor-score-pair { flex-direction: column; }
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
