import { AnalysisReport } from '../core/types/core.js';

export class ReportGenerator {
  generateMarkdownReport(report: AnalysisReport): string {
    let markdown = '';

    markdown += this.generateHeader(report);
    markdown += this.generateProjectSummary(report);
    markdown += this.generateScoreSection(report);
    markdown += this.generateAntiPatternsSection(report);
    markdown += this.generateLayersSection(report);
    markdown += this.generateDiagramSection(report);
    markdown += this.generateSuggestionsSection(report);

    return markdown;
  }

  private generateHeader(report: AnalysisReport): string {
    const timestamp = new Date(report.timestamp).toLocaleString();
    let header = '# Architecture Analysis Report\n\n';
    header += `Generated: ${timestamp}\n`;
    header += `Project: ${report.projectInfo.name}\n`;
    header += `Path: ${report.projectInfo.path}\n\n`;
    return header;
  }

  private generateProjectSummary(report: AnalysisReport): string {
    let summary = '## Project Summary\n\n';
    summary += `| Metric | Value |\n`;
    summary += `|--------|-------|\n`;
    summary += `| Total Files | ${report.projectInfo.totalFiles} |\n`;
    summary += `| Lines of Code | ${report.projectInfo.totalLines.toLocaleString()} |\n`;
    summary += `| Primary Languages | ${report.projectInfo.primaryLanguages.join(', ') || 'N/A'} |\n`;
    summary += `| Frameworks | ${report.projectInfo.frameworks.join(', ') || 'None detected'} |\n\n`;
    return summary;
  }

  private generateScoreSection(report: AnalysisReport): string {
    let section = '## Architecture Quality Score\n\n';
    section += `### Overall Score: **${report.score.overall}/100**\n\n`;

    section += 'Component Breakdown:\n\n';
    for (const component of report.score.components) {
      section += `- **${component.name}**: ${component.score}/100 (weight: ${(component.weight * 100).toFixed(0)}%)\n`;
      section += `  ${component.explanation}\n\n`;
    }

    return section;
  }

  private generateAntiPatternsSection(report: AnalysisReport): string {
    let section = '## Anti-Patterns Detected\n\n';

    if (report.antiPatterns.length === 0) {
      section += 'No significant anti-patterns detected. Excellent architecture!\n\n';
      return section;
    }

    section += `Found **${report.antiPatterns.length}** anti-pattern(s):\n\n`;

    for (const pattern of report.antiPatterns) {
      const severityEmoji: Record<string, string> = {
        CRITICAL: 'X',
        HIGH: 'W',
        MEDIUM: 'o',
        LOW: '-',
      };
      const emoji = severityEmoji[pattern.severity] || 'o';

      section += `### ${emoji} ${pattern.name} [${pattern.severity}]\n\n`;
      section += `**Location**: \`${pattern.location}\`\n\n`;
      section += `**Description**: ${pattern.description}\n\n`;
      section += `**Suggestion**: ${pattern.suggestion}\n\n`;

      if (pattern.metrics && Object.keys(pattern.metrics).length > 0) {
        section += '**Metrics**:\n';
        for (const [key, value] of Object.entries(pattern.metrics)) {
          section += `- ${key}: ${value}\n`;
        }
        section += '\n';
      }
    }

    return section;
  }

  private generateLayersSection(report: AnalysisReport): string {
    let section = '## Architectural Layers\n\n';

    if (report.layers.length === 0) {
      section += 'No layers detected.\n\n';
      return section;
    }

    for (const layer of report.layers) {
      section += `### ${layer.name} Layer\n\n`;
      section += `${layer.description}\n\n`;
      section += `**Files**: ${layer.files.length}\n`;
      section += '```\n';
      for (const file of layer.files.slice(0, 5)) {
        section += `${file}\n`;
      }
      if (layer.files.length > 5) {
        section += `... and ${layer.files.length - 5} more files\n`;
      }
      section += '```\n\n';
    }

    return section;
  }

  private generateDiagramSection(report: AnalysisReport): string {
    let section = '## Architecture Diagram\n\n';
    section += `Type: ${report.diagram.type}\n\n`;
    section += '```mermaid\n';
    section += report.diagram.mermaid;
    section += '\n```\n\n';
    return section;
  }

  private generateSuggestionsSection(report: AnalysisReport): string {
    let section = '## Refactoring Suggestions\n\n';

    if (report.suggestions.length === 0) {
      section += 'No immediate refactoring suggestions.\n\n';
      return section;
    }

    const bySeverity = this.groupBySeverity(report.suggestions);

    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      const suggestions = bySeverity[severity];
      if (!suggestions || suggestions.length === 0) continue;

      section += `### ${severity} Priority\n\n`;

      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        section += `${i + 1}. **${suggestion.title}**\n`;
        section += `   ${suggestion.description}\n`;
        section += `   Impact: ${suggestion.impact}\n\n`;
      }
    }

    return section;
  }

  private groupBySeverity(
    suggestions: Array<{ priority: string; title: string; description: string; impact: string }>
  ): Record<string, typeof suggestions> {
    const grouped: Record<string, typeof suggestions> = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };

    for (const suggestion of suggestions) {
      if (grouped[suggestion.priority]) {
        grouped[suggestion.priority].push(suggestion);
      }
    }

    return grouped;
  }
}
