import * as vscode from 'vscode';
import { FaultDiagnosticProvider } from './linter/diagnosticProvider';

let diagnosticProvider: FaultDiagnosticProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Fault Language Support extension is now active!');
    
    // Initialize diagnostic provider for linting
    diagnosticProvider = new FaultDiagnosticProvider();
    context.subscriptions.push(diagnosticProvider);
    
    // Register commands
    const refreshLintingCommand = vscode.commands.registerCommand('fault.refreshLinting', () => {
        diagnosticProvider.refreshAllDocuments();
        vscode.window.showInformationMessage('Fault linting refreshed');
    });
    
    const clearDiagnosticsCommand = vscode.commands.registerCommand('fault.clearDiagnostics', () => {
        diagnosticProvider.clearAllDiagnostics();
        vscode.window.showInformationMessage('Fault diagnostics cleared');
    });
    
    context.subscriptions.push(refreshLintingCommand, clearDiagnosticsCommand);
    
    // Show activation message
    vscode.window.showInformationMessage('Fault Language Support with linting is now active!');
}

export function deactivate() {
    if (diagnosticProvider) {
        diagnosticProvider.dispose();
    }
}