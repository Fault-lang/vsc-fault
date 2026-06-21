import * as vscode from 'vscode';
import { FaultDiagnosticProvider } from './linter/diagnosticProvider';
import { FaultCodeActionProvider } from './linter/codeActionProvider';

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

    const linter = diagnosticProvider.getLinter();

    vscode.workspace.onDidChangeTextDocument(event => {
        linter.lint(event.document);
    });

    vscode.workspace.onDidOpenTextDocument(document => {
        linter.lint(document);
    });

    context.subscriptions.push(refreshLintingCommand, clearDiagnosticsCommand);

    // Register quick-fix code actions
    const faultSelector = [
        { language: 'fault', scheme: 'file' },
        { language: 'fault', scheme: 'untitled' }
    ];
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            faultSelector,
            new FaultCodeActionProvider(),
            { providedCodeActionKinds: FaultCodeActionProvider.providedCodeActionKinds }
        )
    );

    // Show activation message
    vscode.window.showInformationMessage('Fault Language Support with linting is now active!');
}

export function deactivate() {
    if (diagnosticProvider) {
        diagnosticProvider.dispose();
    }
}