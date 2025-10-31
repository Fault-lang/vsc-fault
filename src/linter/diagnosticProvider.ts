import * as vscode from 'vscode';
import { FaultLinter } from './faultLinter';

export class FaultDiagnosticProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private linter: FaultLinter;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('fault');
        this.linter = new FaultLinter();
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Lint on document open
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(document => {
                if (this.isFaultDocument(document)) {
                    this.lintDocument(document);
                }
            })
        );

        // Lint on document change (with debouncing)
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (this.isFaultDocument(event.document)) {
                    this.debouncedLint(event.document);
                }
            })
        );

        // Clean up diagnostics on document close
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(document => {
                if (this.isFaultDocument(document)) {
                    this.diagnosticCollection.delete(document.uri);
                }
            })
        );

        // Lint all open Fault documents on activation
        vscode.workspace.textDocuments.forEach(document => {
            if (this.isFaultDocument(document)) {
                this.lintDocument(document);
            }
        });
    }

    private isFaultDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'fault';
    }

    private lintTimeout: NodeJS.Timeout | undefined;

    private debouncedLint(document: vscode.TextDocument): void {
        if (this.lintTimeout) {
            clearTimeout(this.lintTimeout);
        }
        
        this.lintTimeout = setTimeout(() => {
            this.lintDocument(document);
        }, 500); // 500ms debounce
    }

    private lintDocument(document: vscode.TextDocument): void {
        try {
            const diagnostics = this.linter.lint(document);
            this.diagnosticCollection.set(document.uri, diagnostics);
        } catch (error) {
            console.error('Error linting Fault document:', error);
            // Clear diagnostics if linting fails
            this.diagnosticCollection.set(document.uri, []);
        }
    }

    public getLinter(): FaultLinter {
        return this.linter;
    }

    public refreshAllDocuments(): void {
        vscode.workspace.textDocuments.forEach(document => {
            if (this.isFaultDocument(document)) {
                this.lintDocument(document);
            }
        });
    }

    public clearAllDiagnostics(): void {
        this.diagnosticCollection.clear();
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
        this.disposables.forEach(d => d.dispose());
        if (this.lintTimeout) {
            clearTimeout(this.lintTimeout);
        }
    }
}