import * as vscode from 'vscode';

export class FaultCodeActionProvider implements vscode.CodeActionProvider {

    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'fault-linter') { continue; }

            switch (diagnostic.code) {
                case 'missing-semicolon':
                    actions.push(this.fixAppendChar(document, diagnostic, ';', 'Add missing semicolon'));
                    break;
                case 'missing-comma':
                    actions.push(this.fixAppendChar(document, diagnostic, ',', 'Add missing comma'));
                    break;
                case 'when-then-temporal':
                    actions.push(...this.fixWhenThenTemporal(document, diagnostic));
                    break;
                case 'const-group-syntax':
                    actions.push(...this.fixConstGroupSyntax(document, diagnostic));
                    break;
                case 'invalid-identifier': {
                    const fix = this.fixInvalidIdentifier(document, diagnostic);
                    if (fix) { actions.push(fix); }
                    break;
                }
            }
        }

        return actions;
    }

    // ── Simple append fixes ──────────────────────────────────────────────────

    private fixAppendChar(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        char: string,
        title: string
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        action.edit = new vscode.WorkspaceEdit();
        const line = document.lineAt(diagnostic.range.start.line);
        action.edit.insert(document.uri, line.range.end, char);
        return action;
    }

    // ── when/then temporal fix ───────────────────────────────────────────────

    private fixWhenThenTemporal(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction[] {
        const line = document.lineAt(diagnostic.range.start.line);
        const text = line.text.trim();

        // Parse: (assert|assume) when <A> then <B> <temporal>;
        const m = text.match(
            /^(assert|assume)\s+when\s+(.+?)\s+then\s+(.+?)\s+(always|eventually|eventually-always|nmt\s+\d+|nft\s+\d+|available)\s*;?\s*$/
        );
        if (!m) { return []; }

        const [, keyword, condA, condB, temporal] = m;
        const indent = line.text.match(/^\s*/)?.[0] ?? '';

        // Option 1: remove temporal qualifier (keep when/then — now valid)
        const removeTemporalAction = new vscode.CodeAction(
            `Remove temporal qualifier (keep when/then)`,
            vscode.CodeActionKind.QuickFix
        );
        removeTemporalAction.diagnostics = [diagnostic];
        removeTemporalAction.isPreferred = true;
        removeTemporalAction.edit = new vscode.WorkspaceEdit();
        removeTemporalAction.edit.replace(
            document.uri,
            line.range,
            `${indent}${keyword} when ${condA} then ${condB};`
        );

        // Option 2: rewrite as boolean expression (allows temporal qualifier)
        const rewriteAction = new vscode.CodeAction(
            `Rewrite as boolean expression (${keyword} !${condA} || ${condB} ${temporal};)`,
            vscode.CodeActionKind.QuickFix
        );
        rewriteAction.diagnostics = [diagnostic];
        rewriteAction.edit = new vscode.WorkspaceEdit();
        rewriteAction.edit.replace(
            document.uri,
            line.range,
            `${indent}${keyword} !${condA} || ${condB} ${temporal};`
        );

        return [removeTemporalAction, rewriteAction];
    }

    // ── const group syntax fix ───────────────────────────────────────────────

    private fixConstGroupSyntax(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction[] {
        const startLine = diagnostic.range.start.line;
        const lines = document.getText().split('\n');

        // Scan forward to find the closing ")"
        let endLine = startLine;
        for (let i = startLine; i < lines.length; i++) {
            if (lines[i].trim() === ')') {
                endLine = i;
                break;
            }
        }

        // Parse inner lines: "NAME = value;" entries
        const entries: string[] = [];
        const indent = lines[startLine].match(/^\s*/)?.[0] ?? '';
        for (let i = startLine + 1; i < endLine; i++) {
            const inner = lines[i].trim();
            if (!inner || inner.startsWith('//')) { continue; }
            // Strip trailing semicolon if present; we'll add it back
            const entry = inner.replace(/;$/, '').trim();
            if (entry) {
                entries.push(`${indent}const ${entry};`);
            }
        }

        if (entries.length === 0) { return []; }

        const action = new vscode.CodeAction(
            'Split into individual const declarations',
            vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        action.edit = new vscode.WorkspaceEdit();

        const replaceRange = new vscode.Range(startLine, 0, endLine, lines[endLine].length);
        action.edit.replace(document.uri, replaceRange, entries.join('\n'));

        return [action];
    }

    // ── invalid identifier fix ───────────────────────────────────────────────

    private fixInvalidIdentifier(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const badName = document.getText(diagnostic.range);
        const fixedName = toCamelCase(badName);
        if (fixedName === badName) { return undefined; }

        const action = new vscode.CodeAction(
            `Rename "${badName}" to "${fixedName}"`,
            vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        action.edit = new vscode.WorkspaceEdit();

        // Replace all word-boundary occurrences in the document
        const text = document.getText();
        const regex = new RegExp(`\\b${escapeRegExp(badName)}\\b`, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const pos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + badName.length);
            action.edit.replace(document.uri, new vscode.Range(pos, endPos), fixedName);
        }

        return action;
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toCamelCase(name: string): string {
    // Split on underscores or hyphens, lowercase first segment, capitalize rest
    const parts = name.split(/[_\-]+/);
    return parts
        .map((part, i) => i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('');
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
