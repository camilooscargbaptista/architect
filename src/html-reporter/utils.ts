import { AntiPattern } from "../types.js";

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


  export function groupAntiPatterns(
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


  export function groupSuggestions(
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
