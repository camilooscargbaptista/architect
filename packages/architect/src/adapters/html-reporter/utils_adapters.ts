import { AntiPattern } from '@girardelli/architect-core/src/core/types/core.js';

export function groupAntiPatterns(
  antiPatterns: AntiPattern[]
): Record<string, { count: number; severity: string; locations: string[]; suggestion: string }> {
  const grouped: Record<string, { count: number; severity: string; locations: string[]; suggestion: string }> = {};
  for (const p of antiPatterns) {
    if (!grouped[p.name]) {
      grouped[p.name] = { count: 0, severity: p.severity, locations: [], suggestion: p.suggestion };
    }
    grouped[p.name]!.count++;
    if (grouped[p.name]!.locations.length < 10) {
      grouped[p.name]!.locations.push(p.location);
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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
