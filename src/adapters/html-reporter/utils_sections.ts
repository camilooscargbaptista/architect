export function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export function scoreEmoji(score: number): string {
  if (score >= 70) return '✅';
  if (score >= 50) return '⚠️';
  return '❌';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Attention';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function opColor(type: string): string {
  switch (type) {
    case 'CREATE': return '#22c55e';
    case 'MOVE': return '#3b82f6';
    case 'MODIFY': return '#f59e0b';
    case 'DELETE': return '#ef4444';
    default: return '#64748b';
  }
}

export function opIcon(type: string): string {
  switch (type) {
    case 'CREATE': return '➕';
    case 'MOVE': return '📦';
    case 'MODIFY': return '✏️';
    case 'DELETE': return '🗑️';
    default: return '📄';
  }
}
