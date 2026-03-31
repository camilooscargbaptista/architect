  export function getStyles(): string {
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

  /* ── AI Prompt Box (Refactoring) ── */
  .ai-prompt-box {
    margin-top: 1rem; padding: 1rem; border-radius: 12px;
    background: linear-gradient(135deg, rgba(16,185,129,0.05), rgba(16,185,129,0.02));
    border: 1px solid rgba(16,185,129,0.2); border-left: 4px solid #10b981;
  }
  .prompt-export-cb { width: 1.25rem; height: 1.25rem; accent-color: #10b981; cursor: pointer; }
  .ai-prompt-box h4 { font-size: 0.9rem; color: #10b981; margin: 0; display: flex; align-items: center; gap: 0.4rem; }
  .ai-prompt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; gap: 1rem; flex-wrap: wrap; }
  .ai-prompt-desc { font-size: 0.8rem; color: #94a3b8; margin: 0; }
  .ai-prompt-btn { 
    background: #10b98120; border: 1px solid #10b981; color: #10b981; padding: 0.4rem 0.8rem; 
    border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .ai-prompt-btn:hover { background: #10b981; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(16,185,129,0.2); }
  .ai-prompt-btn:active { transform: translateY(0); }
  .ai-prompt-pre { position: relative; }
  .ai-prompt-pre pre {
    background: #0f172a; padding: 1rem; border-radius: 8px; border: 1px solid #334155;
    overflow-x: auto; white-space: pre-wrap; font-size: 0.85rem; color: #e2e8f0; font-family: 'SF Mono', monospace; line-height: 1.5;
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
