import { RefactoringPlan, RefactorStep } from "../../types.js";

import { scoreColor, opColor, opIcon, escapeHtml } from "../utils.js";

  export function renderRefactoringPlan(plan: RefactoringPlan): string {
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
          <div class="rbar-before" style="width: ${before}%; background: ${scoreColor(before)}40"><span>${before}</span></div>
          <div class="rbar-after" style="width: ${after}%; background: ${scoreColor(after)}"><span>${after}</span></div>
        </div>
        <div class="refactor-metric-diff" style="color: ${diff > 0 ? '#22c55e' : '#64748b'}">
          ${diff > 0 ? `+${diff}` : diff === 0 ? '—' : String(diff)}
        </div>
      </div>`;
    }).join('');

    const stepsHtml = plan.steps.map(step => renderRefactorStep(step)).join('');

    const criticalCount = plan.steps.filter(s => s.priority === 'CRITICAL').length;
    const highCount = plan.steps.filter(s => s.priority === 'HIGH').length;
    const mediumCount = plan.steps.filter(s => s.priority === 'MEDIUM').length;
    const lowCount = plan.steps.filter(s => s.priority === 'LOW').length;

    return `
<h2 class="section-title">🔧 Refactoring Plan</h2>

<div class="card refactor-score">
  <div class="refactor-score-pair">
    <div class="rscore-box">
      <div class="rscore-num" style="color: ${scoreColor(plan.currentScore.overall)}">${plan.currentScore.overall}</div>
      <div class="rscore-label">Current</div>
    </div>
    <div class="rscore-arrow">
      <svg width="60" height="30" viewBox="0 0 60 30">
        <path d="M5 15 L45 15 M40 8 L48 15 L40 22" stroke="#818cf8" stroke-width="2.5" fill="none"/>
      </svg>
    </div>
    <div class="rscore-box">
      <div class="rscore-num" style="color: ${scoreColor(plan.estimatedScoreAfter.overall)}">${plan.estimatedScoreAfter.overall}</div>
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


  export function renderRefactorStep(step: RefactorStep): string {
    const operationsHtml = step.operations.map(op => `
      <div class="rop">
        <span class="rop-icon">${opIcon(op.type)}</span>
        <span class="rop-badge" style="background: ${opColor(op.type)}20; color: ${opColor(op.type)}; border: 1px solid ${opColor(op.type)}40">${op.type}</span>
        <code class="rop-path">${escapeHtml(op.path)}</code>
        ${op.newPath ? `<span class="rop-arrow">→</span> <code class="rop-path">${escapeHtml(op.newPath)}</code>` : ''}
        <div class="rop-desc">${escapeHtml(op.description)}</div>
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
        <h3>${escapeHtml(step.title)}</h3>
        <span class="severity-badge severity-${step.priority}">${step.priority}</span>
        <span class="tier-badge">Tier ${step.tier}</span>
      </div>
      <p class="rstep-desc">${escapeHtml(step.description)}</p>
      <details class="rstep-details">
        <summary>📖 Why?</summary>
        <p class="rstep-rationale">${escapeHtml(step.rationale)}</p>
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

