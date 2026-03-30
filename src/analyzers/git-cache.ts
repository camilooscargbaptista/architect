/**
 * Git History Cache — Serialize/deserialize GitHistoryReport
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GitHistoryReport } from './git-history.js';

export function saveToCache(
  report: GitHistoryReport,
  projectPath: string,
  cacheDir = '.architect-cache',
): void {
  const dir = path.join(projectPath, cacheDir);
  fs.mkdirSync(dir, { recursive: true });

  const serializable = {
    ...report,
    modules: report.modules.map(m => ({
      ...m,
      files: m.files.map(f => ({
        ...f,
        authors: Array.from(f.authors),
        lastModified: f.lastModified.toISOString(),
      })),
    })),
    hotspots: report.hotspots.map(f => ({
      ...f,
      authors: Array.from(f.authors),
      lastModified: f.lastModified.toISOString(),
    })),
  };

  fs.writeFileSync(path.join(dir, 'git-history.json'), JSON.stringify(serializable, null, 2));
}

export function loadFromCache(
  projectPath: string,
  cacheDir = '.architect-cache',
  maxAgeMs = 3600000,
): GitHistoryReport | null {
  const cachePath = path.join(projectPath, cacheDir, 'git-history.json');
  if (!fs.existsSync(cachePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    if (Date.now() - new Date(raw.analyzedAt).getTime() > maxAgeMs) return null;
    return raw;
  } catch {
    return null;
  }
}
