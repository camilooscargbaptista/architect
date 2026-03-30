import { RefactoringPlan, RefactorStep, FileOperation } from '../core/types/rules.js';

/**
 * Generates interactive HTML report for refactoring plans.
 * Includes step-by-step roadmap, score predictions, and file operation previews.
 */
export class RefactorReportGenerator {
  generateHtml(plan: RefactoringPlan): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Architect Refactoring Plan</title>
${this.getStyles()}
</head>
<body>
${this.renderHeader(plan)}
<div class="container">
  ${this.renderScoreComparison(plan)}
  ${this.renderSummaryStats(plan)}
  ${this.renderRoadmap(plan)}
</div>
${this.renderFooter()}
</body>
</html>`;
  }

  private scoreColor(score: number): string {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  private renderHeader(plan: RefactoringPlan): string {
    const date = new Date(plan.timestamp).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    return `
<div class="header">
  <h1>🔧 Architect — Refactoring Plan</h1>
  <p class="subtitle">Actionable roadmap to improve your architecture</p>
  <div class="meta">
    <span>📂 <strong>${this.escapeHtml(plan.projectPath)}</strong></span>
    <span>📋 <strong>${plan.steps.length}</strong> steps</span>
    <span>🔄 <strong>${plan.totalOperations}</strong> operations</span>
    <span>📅 <strong>${date}</strong></span>
  </div>
</div>`;
  }

  private renderScoreComparison(plan: RefactoringPlan): string {
    const current = plan.currentScore;
    const estimated = plan.estimatedScoreAfter;
    const improvement = estimated.overall - current.overall;

    const metrics = Object.keys(current.breakdown) as Array<keyof typeof current.breakdown>;
    const bars = metrics.map(metric => {
      const before = current.breakdown[metric];
      const after = estimated.breakdown[metric];
      const diff = after - before;
      return `
      <div class="comparison-row">
        <div class="metric-name">${metric}</div>
        <div class="metric-bars">
          <div class="bar-before" style="width: ${before}%; background: ${this.scoreColor(before)}40">
            <span>${before}</span>
          </div>
          <div class="bar-after" style="width: ${after}%; background: ${this.scoreColor(after)}">
            <span>${after}</span>
          </div>
        </div>
        <div class="metric-diff" style="color: ${diff > 0 ? '#22c55e' : '#64748b'}">
          ${diff > 0 ? `+${diff}` : diff === 0 ? '—' : diff}
        </div>
      </div>`;
    }).join('');

    return `
<h2 class="section-title">📊 Score Prediction</h2>
<div class="card score-comparison">
  <div class="score-pair">
    <div class="score-box">
      <div class="score-num" style="color: ${this.scoreColor(current.overall)}">${current.overall}</div>
      <div class="score-label">Current</div>
    </div>
    <div class="score-arrow">
      <svg width="60" height="30" viewBox="0 0 60 30">
        <path d="M5 15 L45 15 M40 8 L48 15 L40 22" stroke="#818cf8" stroke-width="2.5" fill="none"/>
      </svg>
    </div>
    <div class="score-box">
      <div class="score-num" style="color: ${this.scoreColor(estimated.overall)}">${estimated.overall}</div>
      <div class="score-label">Estimated</div>
    </div>
    <div class="score-diff" style="color: #22c55e">+${improvement} pts</div>
  </div>
  <div class="score-bars-section">
    <div class="bars-legend">
      <span class="legend-tag before">Before</span>
      <span class="legend-tag after">After</span>
    </div>
    ${bars}
  </div>
</div>`;
  }

  private renderSummaryStats(plan: RefactoringPlan): string {
    const criticalCount = plan.steps.filter(s => s.priority === 'CRITICAL').length;
    const highCount = plan.steps.filter(s => s.priority === 'HIGH').length;
    const mediumCount = plan.steps.filter(s => s.priority === 'MEDIUM').length;
    const lowCount = plan.steps.filter(s => s.priority === 'LOW').length;

    return `
<div class="stats-grid">
  <div class="stat-card">
    <div class="value">${plan.steps.length}</div>
    <div class="label">Total Steps</div>
  </div>
  <div class="stat-card">
    <div class="value">${plan.tier1Steps}</div>
    <div class="label">Tier 1 (Rules)</div>
  </div>
  <div class="stat-card">
    <div class="value">${plan.tier2Steps}</div>
    <div class="label">Tier 2 (AST)</div>
  </div>
  <div class="stat-card">
    <div class="value">${plan.totalOperations}</div>
    <div class="label">File Operations</div>
  </div>
</div>
<div class="priority-bar">
  ${criticalCount ? `<div class="prio-seg prio-critical" style="flex: ${criticalCount}">🔴 ${criticalCount}</div>` : ''}
  ${highCount ? `<div class="prio-seg prio-high" style="flex: ${highCount}">🟠 ${highCount}</div>` : ''}
  ${mediumCount ? `<div class="prio-seg prio-medium" style="flex: ${mediumCount}">🔵 ${mediumCount}</div>` : ''}
  ${lowCount ? `<div class="prio-seg prio-low" style="flex: ${lowCount}">🟢 ${lowCount}</div>` : ''}
</div>`;
  }

  private renderRoadmap(plan: RefactoringPlan): string {
    if (plan.steps.length === 0) {
      return `
<h2 class="section-title">✅ No Refactoring Needed</h2>
<div class="card success-card">
  <p>Your architecture is clean! No refactoring suggestions at this time.</p>
</div>`;
    }

    const stepsHtml = plan.steps.map(step => this.renderStep(step)).join('');

    return `
<h2 class="section-title">🗺️ Refactoring Roadmap</h2>
<div class="roadmap">
  ${stepsHtml}
</div>`;
  }

  private renderStep(step: RefactorStep): string {
    const operationsHtml = step.operations.map(op => `
      <div class="operation">
        <span class="op-icon">${this.opIcon(op.type)}</span>
        <span class="op-badge" style="background: ${this.opColor(op.type)}20; color: ${this.opColor(op.type)}; border: 1px solid ${this.opColor(op.type)}40">${op.type}</span>
        <code class="op-path">${this.escapeHtml(op.path)}</code>
        ${op.newPath ? `<span class="op-arrow">→</span> <code class="op-path">${this.escapeHtml(op.newPath)}</code>` : ''}
        <div class="op-desc">${this.escapeHtml(op.description)}</div>
      </div>
    `).join('');

    const impactHtml = step.scoreImpact.map(i =>
      `<span class="impact-tag">${i.metric}: ${i.before}→${i.after} <span class="impact-diff">+${i.after - i.before}</span></span>`
    ).join('');

    return `
<div class="step-card" data-priority="${step.priority}">
  <div class="step-header">
    <div class="step-number">${step.id}</div>
    <div class="step-info">
      <div class="step-title-row">
        <h3>${this.escapeHtml(step.title)}</h3>
        <span class="severity-badge severity-${step.priority}">${step.priority}</span>
        <span class="tier-badge">Tier ${step.tier}</span>
      </div>
      <p class="step-desc">${this.escapeHtml(step.description)}</p>
      <details class="step-details">
        <summary>📖 Why?</summary>
        <p class="rationale">${this.escapeHtml(step.rationale)}</p>
      </details>
    </div>
  </div>
  <div class="step-operations">
    <h4>📋 Operations (${step.operations.length})</h4>
    ${operationsHtml}
  </div>
  <div class="step-impact">
    <h4>📈 Score Impact</h4>
    <div class="impact-tags">${impactHtml}</div>
  </div>
</div>`;
  }

  private renderFooter(): string {
    return `
<div class="footer">
  <p>Generated by <a href="https://github.com/camilooscargbaptista/architect">⚡ Architect v3.1</a> — Enterprise Refactoring Engine</p>
  <p>By <strong>Camilo Girardelli</strong> · <a href="https://www.girardellitecnologia.com">Girardelli Tecnologia</a></p>
</div>`;
  }

  private getStyles(): string {
    return `<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0f172a; color: #e2e8f0; line-height: 1.6; min-height: 100vh;
  }
  .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }

  .header {
    text-align: center; padding: 3rem 2rem;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%);
    border-bottom: 1px solid #334155; margin-bottom: 2rem;
  }
  .header h1 {
    font-size: 2.5rem; font-weight: 900;
    background: linear-gradient(135deg, #818cf8, #c084fc, #f472b6);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }
  .header .subtitle { color: #94a3b8; font-size: 1.1rem; font-weight: 300; }
  .header .meta {
    margin-top: 1rem; display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;
  }
  .header .meta span {
    background: #1e293b; padding: 0.4rem 1rem; border-radius: 99px;
    font-size: 0.85rem; color: #94a3b8; border: 1px solid #334155;
  }
  .header .meta span strong { color: #e2e8f0; }

  .section-title {
    font-size: 1.4rem; font-weight: 700; margin: 2.5rem 0 1rem;
    display: flex; align-items: center; gap: 0.5rem;
  }

  .card {
    background: #1e293b; border-radius: 16px; border: 1px solid #334155;
    padding: 1.5rem; margin-bottom: 1rem;
  }
  .success-card { border-color: #22c55e40; color: #22c55e; text-align: center; padding: 2rem; }

  /* Score Comparison */
  .score-comparison { padding: 2rem; }
  .score-pair {
    display: flex; align-items: center; justify-content: center; gap: 1.5rem;
    margin-bottom: 2rem; flex-wrap: wrap;
  }
  .score-box { text-align: center; }
  .score-num { font-size: 3.5rem; font-weight: 900; line-height: 1; }
  .score-label { font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .score-diff { font-size: 1.5rem; font-weight: 700; }

  .bars-legend { display: flex; gap: 1rem; margin-bottom: 0.5rem; }
  .legend-tag { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 6px; }
  .legend-tag.before { background: rgba(255,255,255,0.05); color: #94a3b8; }
  .legend-tag.after { background: rgba(129,140,248,0.2); color: #818cf8; }

  .comparison-row {
    display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;
  }
  .metric-name { width: 100px; font-size: 0.8rem; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .metric-bars { flex: 1; position: relative; height: 30px; }
  .bar-before, .bar-after {
    position: absolute; top: 0; left: 0; height: 15px; border-radius: 4px;
    display: flex; align-items: center; padding-left: 6px;
    font-size: 0.7rem; font-weight: 600; transition: width 1s ease;
  }
  .bar-before { top: 0; }
  .bar-after { top: 16px; }
  .metric-diff { width: 50px; text-align: right; font-weight: 700; font-size: 0.85rem; }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem; }
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

  /* Steps */
  .roadmap { display: flex; flex-direction: column; gap: 1rem; }
  .step-card {
    background: #1e293b; border-radius: 16px; border: 1px solid #334155;
    padding: 1.5rem; transition: border-color 0.2s;
  }
  .step-card:hover { border-color: #818cf8; }
  .step-header { display: flex; gap: 1rem; margin-bottom: 1rem; }
  .step-number {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(135deg, #818cf8, #c084fc);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 1rem; color: white; flex-shrink: 0;
  }
  .step-info { flex: 1; }
  .step-title-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .step-title-row h3 { font-size: 1.1rem; font-weight: 700; }
  .step-desc { color: #94a3b8; font-size: 0.9rem; margin-top: 0.3rem; }

  .severity-badge {
    display: inline-block; padding: 0.15rem 0.5rem; border-radius: 99px;
    font-size: 0.65rem; font-weight: 600; letter-spacing: 0.5px;
  }
  .severity-CRITICAL { background: #dc262620; color: #ef4444; border: 1px solid #ef444440; }
  .severity-HIGH { background: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40; }
  .severity-MEDIUM { background: #3b82f620; color: #60a5fa; border: 1px solid #60a5fa40; }
  .severity-LOW { background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; }

  .tier-badge {
    background: #818cf815; color: #818cf8; border: 1px solid #818cf830;
    padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.65rem; font-weight: 600;
  }

  .step-details { margin-top: 0.5rem; }
  .step-details summary { cursor: pointer; color: #818cf8; font-size: 0.85rem; font-weight: 500; }
  .rationale { color: #64748b; font-size: 0.85rem; margin-top: 0.3rem; font-style: italic; }

  .step-operations { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #334155; }
  .step-operations h4 { font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem; }
  .operation { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .op-icon { font-size: 0.9rem; }
  .op-badge { padding: 0.1rem 0.4rem; border-radius: 6px; font-size: 0.65rem; font-weight: 700; }
  .op-path { background: #0f172a; padding: 1px 6px; border-radius: 4px; font-size: 0.8rem; color: #c084fc; }
  .op-arrow { color: #818cf8; font-weight: 700; }
  .op-desc { width: 100%; color: #64748b; font-size: 0.8rem; padding-left: 1.8rem; }

  .step-impact { margin-top: 0.5rem; }
  .step-impact h4 { font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.3rem; }
  .impact-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .impact-tag {
    background: #22c55e10; color: #22c55e; border: 1px solid #22c55e30;
    padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.75rem; font-weight: 500;
  }
  .impact-diff { font-weight: 700; }

  .footer {
    text-align: center; padding: 2rem; color: #475569; font-size: 0.85rem;
    border-top: 1px solid #1e293b; margin-top: 3rem;
  }
  .footer a { color: #818cf8; text-decoration: none; }

  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .score-pair { flex-direction: column; }
    .container { padding: 1rem; }
  }

  @media print {
    body { background: white; color: #1e293b; }
    .card, .step-card, .stat-card { background: white; border-color: #e2e8f0; }
  }
</style>`;
  }
}
