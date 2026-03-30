import { AnalysisReport } from "../types.js";

  /**
   * All JavaScript for D3.js visualizations, animated counters, and radar chart
   */
  export function getScripts(report: AnalysisReport): string {
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

