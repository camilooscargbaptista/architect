import { escapeHtml } from "../utils.js";

  export function renderSuggestions(
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
            <strong>${escapeHtml(s.title)}</strong>
            ${s.count > 1 ? `<span class="count-badge">×${s.count}</span>` : ''}
            <br/><small class="suggestion">${escapeHtml(s.description)}</small>
          </td>
          <td class="impact">${escapeHtml(s.impact)}</td>
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
