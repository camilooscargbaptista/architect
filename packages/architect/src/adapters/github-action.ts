import * as core from '@actions/core';
import * as github from '@actions/github';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { ValidationResult } from '@girardelli/architect-core/src/core/types/architect-rules.js';

export class GithubActionAdapter {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context = github.context;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
  }

  async postComment(
    headReport: AnalysisReport,
    baseReport?: AnalysisReport | null,
    validationResult?: ValidationResult
  ): Promise<void> {
    if (!this.context.payload.pull_request) {
      core.info('Not running in a Pull Request context. Skipping comment.');
      return;
    }

    const issueNumber = this.context.payload.pull_request.number;
    const body = this.buildMarkdownBody(headReport, baseReport, validationResult);

    await this.octokit.rest.issues.createComment({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      issue_number: issueNumber,
      body,
    });
  }

  private buildMarkdownBody(
    headReport: AnalysisReport,
    baseReport?: AnalysisReport | null,
    validationResult?: ValidationResult
  ): string {
    const hScore = headReport.score.overall;
    const bScore = baseReport ? baseReport.score.overall : null;

    let deltaStr = '';
    if (bScore !== null) {
      const delta = hScore - bScore;
      if (delta > 0) {
        deltaStr = `📈 **+${delta}** (Improved from ${bScore})`;
      } else if (delta < 0) {
        deltaStr = `📉 **${delta}** (Regressed from ${bScore})`;
      } else {
        deltaStr = `➖ **0** (Stable at ${bScore})`;
      }
    } else {
      deltaStr = `🆕 (First Scan)`;
    }

    let validationStr = '';
    if (validationResult) {
      if (validationResult.success) {
        validationStr = `✅ **Quality Gates Passed!**`;
      } else {
        validationStr = `❌ **Quality Gates Failed!**\n\n`;
        validationResult.violations.forEach(v => {
          validationStr += `- **[${v.level.toUpperCase()}]** \`${v.rule}\`: ${v.message}\n`;
        });
      }
    }

    // Build anti-pattern warnings
    const critical = headReport.antiPatterns.filter(a => a.severity === 'CRITICAL');
    const high = headReport.antiPatterns.filter(a => a.severity === 'HIGH');
    
    let antiPatternsStr = ``;
    if (critical.length > 0 || high.length > 0) {
      antiPatternsStr = `### ⚠️ Anti-Patterns Detected\n`;
      critical.forEach(p => {
        antiPatternsStr += `- 🔴 **${p.name}** in \`${p.location}\`: ${p.description}\n`;
      });
      high.forEach(p => {
        antiPatternsStr += `- 🟠 **${p.name}** in \`${p.location}\`: ${p.description}\n`;
      });
    } else {
      antiPatternsStr = `✅ **No Critical/High Anti-Patterns!** Code is clean.\n`;
    }

    return `
## 🏗 Architect Intelligence Report

> **Architecture Score:** \`${hScore}/100\`
> **Delta:** ${deltaStr}

${validationStr}

---
### 📊 Score Breakdown
| Metric | Score |
| --- | --- |
| 🧩 Modularity | ${headReport.score.breakdown.modularity} |
| 🔗 Coupling | ${headReport.score.breakdown.coupling} |
| 🎯 Cohesion | ${headReport.score.breakdown.cohesion} |
| 🥞 Layering | ${headReport.score.breakdown.layering} |

${antiPatternsStr}

---
*Report generated automatically by [Architect Genesis API](https://github.com/girardelli/architect).*
    `.trim();
  }
}
