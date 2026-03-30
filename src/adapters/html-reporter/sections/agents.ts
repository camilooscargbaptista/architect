import { AgentSuggestion } from '../../../core/agent-generator/index.js';

import { escapeHtml } from "../utils_sections.js";

  export function renderAgentSuggestions(s: AgentSuggestion): string {
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
