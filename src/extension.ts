import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Fault Language Support extension is now active!');
    
    // Register language features if needed
    // This is where you could add language server integration, code completion, etc.
}

export function deactivate() {
    // Cleanup code if needed
}