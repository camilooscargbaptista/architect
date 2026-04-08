/**
 * Architect Intelligence — VSCode Extension v9.0
 *
 * Features:
 * - Score Diagnostics: Inline annotations per file with architecture health
 * - Code Lens: Hub detection with "Click to split" actions
 * - Forecast Decorations: At-risk files highlighted with severity colors
 * - Genesis Integration: Right-click → "Generate refactoring prompt"
 * - Status Bar: Live architecture score display
 * - Full Analyze & Refactor commands (upgraded from v8.1)
 *
 * @since v9.0 — Fase 3.6
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════
// TYPES (inline — no external deps for bundled extension)
// ═══════════════════════════════════════════════════════════════

interface ArchitectScore {
  overall: number;
  breakdown: {
    modularity: number;
    coupling: number;
    cohesion: number;
    layering: number;
  };
  components: Array<{
    name: string;
    score: number;
    maxScore: number;
    weight: number;
    explanation: string;
  }>;
}

interface AntiPattern {
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  description: string;
  suggestion: string;
  affectedFiles?: string[];
  metrics?: Record<string, number | string>;
}

interface RefactoringPlan {
  steps: RefactorStep[];
  currentScore: ArchitectScore;
  estimatedScoreAfter: { overall: number; breakdown: Record<string, number> };
  totalOperations: number;
}

interface RefactorStep {
  id: number;
  tier: 1 | 2;
  rule: string;
  priority: string;
  title: string;
  description: string;
  rationale: string;
  operations: Array<{ type: string; path: string; description: string }>;
  scoreImpact: Array<{ metric: string; before: number; after: number }>;
}

interface FullReport {
  report: {
    score: ArchitectScore;
    antiPatterns: AntiPattern[];
    dependencyGraph: {
      nodes: string[];
      edges: Array<{ from: string; to: string; type: string; weight: number }>;
    };
  };
  plan: RefactoringPlan;
}

interface ForecastResult {
  overallRisk: string;
  headline: string;
  atRiskModules: Array<{
    modulePath: string;
    currentScore: number;
    predictedScore: number;
    riskLevel: string;
    weeklyDelta: number;
    drivers: string[];
  }>;
  projectForecast: {
    currentScore: number;
    predictedScore: number;
    scoreDelta: number;
    weeklyDelta: number;
    confidence: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let cachedReport: FullReport | undefined;
let cachedForecast: ForecastResult | undefined;
let statusBarItem: vscode.StatusBarItem;
let diagnosticCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;

// Decoration types for forecast overlay
let criticalDecorationType: vscode.TextEditorDecorationType;
let highRiskDecorationType: vscode.TextEditorDecorationType;
let mediumRiskDecorationType: vscode.TextEditorDecorationType;

// Hub tracking for code lens
let hubFiles: Map<string, { dependents: number; rule: string; title: string }> = new Map();

// ═══════════════════════════════════════════════════════════════
// ACTIVATION
// ═══════════════════════════════════════════════════════════════

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Architect');
  outputChannel.appendLine('Architect Intelligence v9.0 activated');

  // Diagnostics
  diagnosticCollection = vscode.languages.createDiagnosticCollection('architect');

  // Status Bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.command = 'architect.analyze';
  statusBarItem.tooltip = 'Architect: Click to analyze architecture';
  statusBarItem.text = '$(circuit-board) Architect';
  statusBarItem.show();

  // Decoration types for risk overlay
  criticalDecorationType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: '#ff4444',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    gutterIconPath: context.asAbsolutePath(''),
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    isWholeLine: true,
    after: {
      contentText: ' ⚠ Critical Risk',
      color: '#ff4444',
      fontStyle: 'italic',
      margin: '0 0 0 2em',
    },
  });

  highRiskDecorationType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: '#ff8800',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    backgroundColor: 'rgba(255, 136, 0, 0.06)',
    isWholeLine: true,
    after: {
      contentText: ' ⚡ High Risk',
      color: '#ff8800',
      fontStyle: 'italic',
      margin: '0 0 0 2em',
    },
  });

  mediumRiskDecorationType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: '#ffcc00',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    backgroundColor: 'rgba(255, 204, 0, 0.04)',
    isWholeLine: true,
    after: {
      contentText: ' ◆ Medium Risk',
      color: '#ffcc00',
      fontStyle: 'italic',
      margin: '0 0 0 2em',
    },
  });

  // ── Register Commands ──────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('architect.analyze', cmdAnalyze),
    vscode.commands.registerCommand('architect.refactor', cmdRefactor),
    vscode.commands.registerCommand('architect.forecast', cmdForecast),
    vscode.commands.registerCommand('architect.genesis', cmdGenesis),
    vscode.commands.registerCommand('architect.genesisFile', cmdGenesisForFile),
    vscode.commands.registerCommand('architect.pluginList', cmdPluginList),
    vscode.commands.registerCommand('architect.showAntiPatterns', cmdShowAntiPatterns),
    vscode.commands.registerCommand('architect.splitHub', cmdSplitHub),
  );

  // ── Register Providers ─────────────────────────────────────

  const codeLensProvider = new ArchitectCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file', pattern: '**/*.{ts,tsx,js,jsx,py,go,rs,java}' },
      codeLensProvider,
    ),
  );

  // ── Register Event Handlers ────────────────────────────────

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(onEditorChanged),
    vscode.workspace.onDidSaveTextDocument(onDocumentSaved),
  );

  // ── Subscriptions ──────────────────────────────────────────

  context.subscriptions.push(
    statusBarItem,
    diagnosticCollection,
    outputChannel,
    criticalDecorationType,
    highRiskDecorationType,
    mediumRiskDecorationType,
  );

  // Auto-analyze on activation if workspace is open
  const config = vscode.workspace.getConfiguration('architect');
  if (config.get<boolean>('autoAnalyzeOnOpen', false)) {
    setTimeout(() => vscode.commands.executeCommand('architect.analyze'), 2000);
  }
}

export function deactivate() {
  cachedReport = undefined;
  cachedForecast = undefined;
  hubFiles.clear();
}

// ═══════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════

/**
 * Full architecture analysis with diagnostics and decorations.
 */
async function cmdAnalyze(): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Architect: Analyzing architecture...',
    cancellable: false,
  }, async (progress) => {
    try {
      progress.report({ message: 'Parsing AST and dependency graph...' });

      const { stdout } = await execAsync(
        'npx -y @girardelli/architect@latest analyze . --format json',
        { cwd: rootPath, env: { ...process.env, CI: 'true' }, maxBuffer: 50 * 1024 * 1024 },
      );

      const result = JSON.parse(stdout) as FullReport;
      cachedReport = result;

      progress.report({ message: 'Updating diagnostics...' });
      updateDiagnostics(result, rootPath);
      updateStatusBar(result.report.score);
      updateHubIndex(result, rootPath);

      const score = result.report.score;
      const delta = result.plan.estimatedScoreAfter.overall - score.overall;
      const msg = `Score: ${score.overall}/100 · ${result.report.antiPatterns.length} anti-patterns · ${result.plan.steps.length} refactor steps (+${delta} pts potential)`;

      if (score.overall >= 80) {
        vscode.window.showInformationMessage(`✅ ${msg}`);
      } else if (score.overall >= 60) {
        vscode.window.showWarningMessage(`⚠️ ${msg}`, 'Show Anti-Patterns').then(choice => {
          if (choice === 'Show Anti-Patterns') {
            vscode.commands.executeCommand('architect.showAntiPatterns');
          }
        });
      } else {
        vscode.window.showErrorMessage(`🚨 ${msg}`, 'Show Anti-Patterns', 'Refactor Plan').then(choice => {
          if (choice === 'Show Anti-Patterns') {
            vscode.commands.executeCommand('architect.showAntiPatterns');
          } else if (choice === 'Refactor Plan') {
            vscode.commands.executeCommand('architect.refactor');
          }
        });
      }

      outputChannel.appendLine(`[${new Date().toISOString()}] Analysis complete: ${score.overall}/100`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Architect analysis failed: ${error.message}`);
      outputChannel.appendLine(`[ERROR] ${error.message}`);
    }
  });
}

/**
 * Generate refactoring plan via interactive terminal.
 */
async function cmdRefactor(): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  const terminal = vscode.window.createTerminal({ name: 'Architect Refactor', cwd: rootPath });
  terminal.show();
  terminal.sendText('npx -y @girardelli/architect@latest refactor . --interactive');
}

/**
 * Run forecast analysis and apply decorations to at-risk files.
 */
async function cmdForecast(): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Architect: Running architecture forecast...',
    cancellable: false,
  }, async (progress) => {
    try {
      progress.report({ message: 'Analyzing git history and predicting decay...' });

      const { stdout } = await execAsync(
        'npx -y @girardelli/architect@latest forecast . --format json',
        { cwd: rootPath, env: { ...process.env, CI: 'true' }, maxBuffer: 20 * 1024 * 1024 },
      );

      const forecast = JSON.parse(stdout) as ForecastResult;
      cachedForecast = forecast;

      progress.report({ message: 'Applying risk decorations...' });
      applyForecastDecorations(forecast, rootPath);

      const riskColor = forecast.overallRisk === 'critical' ? '🔴'
        : forecast.overallRisk === 'high' ? '🟠'
        : forecast.overallRisk === 'medium' ? '🟡'
        : '🟢';

      const fc = forecast.projectForecast;
      vscode.window.showInformationMessage(
        `${riskColor} Forecast: ${forecast.overallRisk.toUpperCase()} risk · Score ${Math.round(fc.currentScore)} → ${Math.round(fc.predictedScore)} (${fc.scoreDelta > 0 ? '+' : ''}${fc.scoreDelta.toFixed(1)}) · ${forecast.atRiskModules.length} modules at risk`,
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Forecast failed: ${error.message}`);
    }
  });
}

/**
 * Open Genesis interactive terminal.
 */
async function cmdGenesis(): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  const terminal = vscode.window.createTerminal({ name: 'Architect Genesis', cwd: rootPath });
  terminal.show();
  terminal.sendText('npx -y @girardelli/architect@latest genesis');
}

/**
 * Generate a Genesis refactoring prompt for the active file.
 * Triggered via right-click context menu.
 */
async function cmdGenesisForFile(uri?: vscode.Uri): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  const filePath = uri?.fsPath ?? vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!filePath) {
    vscode.window.showWarningMessage('No file selected for Genesis prompt generation.');
    return;
  }

  const relativePath = path.relative(rootPath, filePath);

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Architect: Generating Genesis prompt for ${relativePath}...`,
    cancellable: false,
  }, async () => {
    try {
      // Run analysis and find refactoring steps for this file
      const { stdout } = await execAsync(
        'npx -y @girardelli/architect@latest refactor . --format json',
        { cwd: rootPath, env: { ...process.env, CI: 'true' }, maxBuffer: 20 * 1024 * 1024 },
      );

      const plan = JSON.parse(stdout) as RefactoringPlan;

      // Filter steps that affect this file
      const relevantSteps = plan.steps.filter(step =>
        step.operations.some(op =>
          op.path === relativePath || op.path.endsWith(relativePath),
        ),
      );

      if (relevantSteps.length === 0) {
        vscode.window.showInformationMessage(
          `✅ No refactoring suggestions for ${relativePath}. File looks clean!`,
        );
        return;
      }

      // Build Genesis prompt content
      const promptLines = [
        `# Architect Genesis — Refactoring Prompt`,
        `# File: ${relativePath}`,
        `# Generated: ${new Date().toISOString()}`,
        ``,
        `## Refactoring Steps for ${relativePath}`,
        ``,
      ];

      for (const step of relevantSteps) {
        promptLines.push(`### Step ${step.id}: ${step.title}`);
        promptLines.push(`**Rule:** ${step.rule} | **Priority:** ${step.priority} | **Tier:** ${step.tier}`);
        promptLines.push(`**Rationale:** ${step.rationale}`);
        promptLines.push(``);
        promptLines.push(`${step.description}`);
        promptLines.push(``);
        for (const op of step.operations.filter(o => o.path === relativePath || o.path.endsWith(relativePath))) {
          promptLines.push(`- **${op.type}** ${op.path}: ${op.description}`);
        }
        promptLines.push(``);
        if (step.scoreImpact.length > 0) {
          promptLines.push(`**Score Impact:**`);
          for (const impact of step.scoreImpact) {
            promptLines.push(`- ${impact.metric}: ${impact.before} → ${impact.after}`);
          }
          promptLines.push(``);
        }
      }

      // Open as a new document
      const doc = await vscode.workspace.openTextDocument({
        content: promptLines.join('\n'),
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Genesis prompt generation failed: ${error.message}`);
    }
  });
}

/**
 * List installed plugins.
 */
async function cmdPluginList(): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  const terminal = vscode.window.createTerminal({ name: 'Architect Plugins', cwd: rootPath });
  terminal.show();
  terminal.sendText('npx -y @girardelli/architect@latest plugin list');
}

/**
 * Show anti-patterns in a quick pick with navigation.
 */
async function cmdShowAntiPatterns(): Promise<void> {
  if (!cachedReport) {
    vscode.window.showWarningMessage('Run "Architect: Analyze" first to detect anti-patterns.');
    return;
  }

  const patterns = cachedReport.report.antiPatterns;
  if (patterns.length === 0) {
    vscode.window.showInformationMessage('No anti-patterns detected!');
    return;
  }

  const items = patterns.map(p => ({
    label: `$(${severityIcon(p.severity)}) ${p.name}`,
    description: p.severity,
    detail: `${p.description}\nSuggestion: ${p.suggestion}`,
    location: p.location,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `${patterns.length} anti-patterns detected — select to navigate`,
    matchOnDetail: true,
  });

  if (selected) {
    await navigateToLocation(selected.location);
  }
}

/**
 * Command triggered by code lens to split a hub file.
 */
async function cmdSplitHub(filePath: string): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  const relativePath = path.relative(rootPath, filePath);
  const choice = await vscode.window.showInformationMessage(
    `Split hub "${relativePath}"? This will open an interactive refactoring session.`,
    'Start Interactive Refactor',
    'Generate Prompt Only',
  );

  if (choice === 'Start Interactive Refactor') {
    const terminal = vscode.window.createTerminal({ name: 'Architect Split Hub', cwd: rootPath });
    terminal.show();
    terminal.sendText('npx -y @girardelli/architect@latest refactor . --interactive');
  } else if (choice === 'Generate Prompt Only') {
    await cmdGenesisForFile(vscode.Uri.file(filePath));
  }
}

// ═══════════════════════════════════════════════════════════════
// CODE LENS PROVIDER
// ═══════════════════════════════════════════════════════════════

class ArchitectCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const filePath = document.uri.fsPath;
    const hub = hubFiles.get(filePath);

    if (!hub) return [];

    const topOfFile = new vscode.Range(0, 0, 0, 0);

    const lenses: vscode.CodeLens[] = [
      new vscode.CodeLens(topOfFile, {
        title: `$(circuit-board) Hub File — ${hub.dependents} dependents`,
        command: '',
        tooltip: `This file is imported by ${hub.dependents} other files. Consider splitting to reduce coupling.`,
      }),
      new vscode.CodeLens(topOfFile, {
        title: '$(split-horizontal) Split this hub',
        command: 'architect.splitHub',
        arguments: [filePath],
        tooltip: 'Open an interactive refactoring session to split this hub file',
      }),
    ];

    // Also show anti-pattern info if available
    if (cachedReport) {
      const rootPath = getWorkspaceRoot();
      if (rootPath) {
        const relativePath = path.relative(rootPath, filePath);
        const patterns = cachedReport.report.antiPatterns.filter(
          ap => ap.location === relativePath || ap.affectedFiles?.includes(relativePath),
        );

        for (const ap of patterns) {
          lenses.push(new vscode.CodeLens(topOfFile, {
            title: `$(warning) ${ap.name} (${ap.severity})`,
            command: 'architect.showAntiPatterns',
            tooltip: ap.description,
          }));
        }
      }
    }

    return lenses;
  }
}

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════

function updateDiagnostics(report: FullReport, rootPath: string): void {
  diagnosticCollection.clear();

  const fileDiagnostics = new Map<string, vscode.Diagnostic[]>();

  for (const ap of report.report.antiPatterns) {
    const absolutePath = path.isAbsolute(ap.location)
      ? ap.location
      : path.join(rootPath, ap.location);

    const severity = ap.severity === 'CRITICAL' ? vscode.DiagnosticSeverity.Error
      : ap.severity === 'HIGH' ? vscode.DiagnosticSeverity.Warning
      : ap.severity === 'MEDIUM' ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `[Architect] ${ap.name}: ${ap.description}\n💡 ${ap.suggestion}`,
      severity,
    );
    diagnostic.source = 'Architect';
    diagnostic.code = ap.name;

    const existing = fileDiagnostics.get(absolutePath) ?? [];
    existing.push(diagnostic);
    fileDiagnostics.set(absolutePath, existing);

    // Also add diagnostics to affected files
    if (ap.affectedFiles) {
      for (const affected of ap.affectedFiles) {
        const affectedPath = path.isAbsolute(affected)
          ? affected
          : path.join(rootPath, affected);

        const affectedDiag = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          `[Architect] Affected by ${ap.name} in ${ap.location}: ${ap.suggestion}`,
          vscode.DiagnosticSeverity.Hint,
        );
        affectedDiag.source = 'Architect';

        const affectedExisting = fileDiagnostics.get(affectedPath) ?? [];
        affectedExisting.push(affectedDiag);
        fileDiagnostics.set(affectedPath, affectedExisting);
      }
    }
  }

  // Add refactoring step diagnostics
  for (const step of report.plan.steps) {
    for (const op of step.operations) {
      const absolutePath = path.isAbsolute(op.path)
        ? op.path
        : path.join(rootPath, op.path);

      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `[Architect Refactor] ${step.title}: ${op.description}`,
        vscode.DiagnosticSeverity.Hint,
      );
      diagnostic.source = 'Architect';
      diagnostic.code = `refactor-${step.rule}`;

      const existing = fileDiagnostics.get(absolutePath) ?? [];
      existing.push(diagnostic);
      fileDiagnostics.set(absolutePath, existing);
    }
  }

  for (const [filePath, diagnostics] of fileDiagnostics) {
    diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
  }
}

// ═══════════════════════════════════════════════════════════════
// STATUS BAR
// ═══════════════════════════════════════════════════════════════

function updateStatusBar(score: ArchitectScore): void {
  const icon = score.overall >= 80 ? '$(pass-filled)'
    : score.overall >= 60 ? '$(warning)'
    : '$(error)';

  statusBarItem.text = `${icon} Architect: ${score.overall}/100`;
  statusBarItem.tooltip = [
    `Architecture Score: ${score.overall}/100`,
    `Modularity: ${score.breakdown.modularity}`,
    `Coupling: ${score.breakdown.coupling}`,
    `Cohesion: ${score.breakdown.cohesion}`,
    `Layering: ${score.breakdown.layering}`,
    '',
    'Click to re-analyze',
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════
// FORECAST DECORATIONS
// ═══════════════════════════════════════════════════════════════

function applyForecastDecorations(forecast: ForecastResult, rootPath: string): void {
  const riskMap = new Map<string, { riskLevel: string; currentScore: number; predictedScore: number; weeklyDelta: number }>();

  for (const mod of forecast.atRiskModules) {
    const absolutePath = path.isAbsolute(mod.modulePath)
      ? mod.modulePath
      : path.join(rootPath, mod.modulePath);
    riskMap.set(absolutePath, mod);
  }

  // Apply to all visible editors
  for (const editor of vscode.window.visibleTextEditors) {
    const filePath = editor.document.uri.fsPath;
    const risk = riskMap.get(filePath);

    if (!risk) {
      editor.setDecorations(criticalDecorationType, []);
      editor.setDecorations(highRiskDecorationType, []);
      editor.setDecorations(mediumRiskDecorationType, []);
      continue;
    }

    const firstLine = new vscode.Range(0, 0, 0, 0);
    const decorations = [{ range: firstLine, hoverMessage: buildRiskHoverMessage(risk) }];

    if (risk.riskLevel === 'critical') {
      editor.setDecorations(criticalDecorationType, decorations);
      editor.setDecorations(highRiskDecorationType, []);
      editor.setDecorations(mediumRiskDecorationType, []);
    } else if (risk.riskLevel === 'high') {
      editor.setDecorations(criticalDecorationType, []);
      editor.setDecorations(highRiskDecorationType, decorations);
      editor.setDecorations(mediumRiskDecorationType, []);
    } else {
      editor.setDecorations(criticalDecorationType, []);
      editor.setDecorations(highRiskDecorationType, []);
      editor.setDecorations(mediumRiskDecorationType, decorations);
    }
  }
}

function buildRiskHoverMessage(risk: { riskLevel: string; currentScore: number; predictedScore: number; weeklyDelta: number }): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`### 📊 Architect Forecast\n\n`);
  md.appendMarkdown(`**Risk Level:** ${risk.riskLevel.toUpperCase()}\n\n`);
  md.appendMarkdown(`**Score:** ${risk.currentScore} → ${risk.predictedScore} (${risk.weeklyDelta > 0 ? '+' : ''}${risk.weeklyDelta.toFixed(2)}/week)\n\n`);
  md.appendMarkdown(`---\n\n`);
  md.appendMarkdown(`[Run Forecast](command:architect.forecast) | [Refactor](command:architect.refactor)`);
  md.isTrusted = true;
  return md;
}

// ═══════════════════════════════════════════════════════════════
// HUB INDEX (for Code Lens)
// ═══════════════════════════════════════════════════════════════

function updateHubIndex(report: FullReport, rootPath: string): void {
  hubFiles.clear();

  // Count incoming edges per file (dependents)
  const incomingCount = new Map<string, number>();
  for (const edge of report.report.dependencyGraph.edges) {
    const current = incomingCount.get(edge.to) ?? 0;
    incomingCount.set(edge.to, current + 1);
  }

  // Threshold: a file is a "hub" if it has 5+ dependents
  const config = vscode.workspace.getConfiguration('architect');
  const hubThreshold = config.get<number>('hubThreshold', 5);

  for (const [file, count] of incomingCount) {
    if (count >= hubThreshold) {
      const absolutePath = path.isAbsolute(file)
        ? file
        : path.join(rootPath, file);

      hubFiles.set(absolutePath, {
        dependents: count,
        rule: 'hub-splitter',
        title: `Hub file with ${count} dependents`,
      });
    }
  }

  // Also add any files from hub-splitter refactoring steps
  for (const step of report.plan.steps) {
    if (step.rule === 'hub-splitter') {
      for (const op of step.operations) {
        const absolutePath = path.isAbsolute(op.path)
          ? op.path
          : path.join(rootPath, op.path);

        if (!hubFiles.has(absolutePath)) {
          hubFiles.set(absolutePath, {
            dependents: 0,
            rule: step.rule,
            title: step.title,
          });
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

function onEditorChanged(editor: vscode.TextEditor | undefined): void {
  if (!editor) return;

  // Re-apply forecast decorations to new editor
  if (cachedForecast) {
    const rootPath = getWorkspaceRoot();
    if (rootPath) {
      applyForecastDecorations(cachedForecast, rootPath);
    }
  }
}

function onDocumentSaved(_document: vscode.TextDocument): void {
  const config = vscode.workspace.getConfiguration('architect');
  if (config.get<boolean>('analyzeOnSave', false)) {
    vscode.commands.executeCommand('architect.analyze');
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No workspace open. Open a project folder first.');
    return undefined;
  }
  return folders[0]!.uri.fsPath;
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'error';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    default: return 'question';
  }
}

async function navigateToLocation(location: string): Promise<void> {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) return;

  const absolutePath = path.isAbsolute(location)
    ? location
    : path.join(rootPath, location);

  try {
    const doc = await vscode.workspace.openTextDocument(absolutePath);
    await vscode.window.showTextDocument(doc);
  } catch {
    vscode.window.showWarningMessage(`Could not open file: ${location}`);
  }
}
