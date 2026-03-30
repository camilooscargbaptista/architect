import { AnalysisReport } from "../../types.js";

import { escapeHtml } from "../utils.js";

  export function renderLayers(report: AnalysisReport): string {
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
        <div class="desc">${escapeHtml(l.description)}</div>
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

  export function renderDependencyGraph(report: AnalysisReport): string {
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
      return `<label class="graph-filter-check"><input type="checkbox" checked data-layer="${l}" onchange="toggleGraphLayer('${l}', checked)"><span class="legend-dot" style="background: ${color}"></span> ${l}</label>`;
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
      <input type="text" id="graphSearch" class="graph-search" placeholder="🔍 Search node..." oninput="filterGraphNodes(value)">
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