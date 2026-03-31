import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
  console.log('Architect Intelligence Extension Activated');

  let analyzeCmd = vscode.commands.registerCommand('architect.analyze', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace open to analyze.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Architect: Parsing AST layers and finding anti-patterns...",
      cancellable: false
    }, async (progress) => {
      try {
        const { stdout } = await execAsync('npx -y @girardelli/architect@latest score --format json', { 
          cwd: rootPath,
          env: { ...process.env, CI: 'true' }
        });
        
        const score = JSON.parse(stdout);
        
        const message = `Architect Score: ${score.overall}/100 (Modularity: ${score.breakdown.modularity}, Coupling: ${score.breakdown.coupling})`;
        
        if (score.overall >= 80) {
          vscode.window.showInformationMessage(`✅ ${message}`);
        } else if (score.overall >= 60) {
          vscode.window.showWarningMessage(`⚠️ ${message}`);
        } else {
          vscode.window.showErrorMessage(`🚨 ${message}. Severe Anti-patterns detected.`);
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Architect Failed: ${error.message}`);
      }
    });
  });

  let refactorCmd = vscode.commands.registerCommand('architect.refactor', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    
    const rootPath = workspaceFolders[0].uri.fsPath;
    const terminal = vscode.window.createTerminal({ name: "Architect Genesis", cwd: rootPath });
    terminal.show();
    terminal.sendText(`npx -y @girardelli/architect@latest genesis`);
  });

  context.subscriptions.push(analyzeCmd, refactorCmd);
}

export function deactivate() {}
