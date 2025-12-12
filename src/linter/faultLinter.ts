import * as vscode from 'vscode';

export interface LintRule {
    id: string;
    message: string;
    severity: vscode.DiagnosticSeverity;
    pattern: RegExp;
    validate?: (match: RegExpMatchArray, line: string, lineNumber: number, document?: vscode.TextDocument) => boolean;
}

export class FaultLinter {
    private rules: LintRule[] = [
        // Syntax validation rules
        {
            id: 'missing-semicolon',
            message: 'Missing semicolon at end of statement',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /.+/,  // Match any non-empty line
            validate: (match, line, lineNumber) => {
                const trimmed = line.trim();

                // Skip empty lines and comments
                if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                    return false;
                }

                // Skip lines that already end with semicolon or opening brace
                if (trimmed.endsWith(';') || trimmed.endsWith('{')) {
                    return false;
                }

                // Skip closing braces (they never need semicolons by themselves)
                if (trimmed === '}' || trimmed.endsWith('}') && !trimmed.includes('=')) {
                    return false;
                }

                // Skip if/else keywords (never need semicolons)
                if (/^\s*(if|else|for)\b/.test(trimmed)) {
                    return false;
                }

                // Check for top-level declarations that MUST have semicolons

                // 1. system <name> - MUST have semicolon
                if (/^\s*system\s+[a-zA-Z_][a-zA-Z0-9_]*\s*$/.test(trimmed)) {
                    return true;
                }

                // 2. spec <name> - MUST have semicolon
                if (/^\s*spec\s+[a-zA-Z_][a-zA-Z0-9_]*\s*$/.test(trimmed)) {
                    return true;
                }

                // 3. import "..." - MUST have semicolon (but not if it ends with {})
                if (/^\s*import\s+/.test(trimmed) && !trimmed.endsWith(')')) {
                    return true;
                }

                // 4. global x = ... - MUST have semicolon
                if (/^\s*global\s+[a-zA-Z_]/.test(trimmed)) {
                    return true;
                }

                // 5. const declarations - MUST have semicolon (but not if it's const (...))
                if (/^\s*const\s+[a-zA-Z_]/.test(trimmed) && !trimmed.includes('(')) {
                    return true;
                }

                // 6. def X = flow/stock {...} - MUST have semicolon
                if (/^\s*def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(trimmed) && trimmed.endsWith('}')) {
                    return true;
                }

                // 7. component X = states {...} - MUST have semicolon
                if (/^\s*component\s+[a-zA-Z_]/.test(trimmed) && trimmed.endsWith('}')) {
                    return true;
                }

                // 8. start {...} - MUST have semicolon
                if (/^\s*start\s*\{/.test(trimmed) && trimmed.endsWith('}')) {
                    return true;
                }

                // 9. assert/assume statements - MUST have semicolon
                if (/^\s*(assert|assume)\s+/.test(trimmed)) {
                    return true;
                }

                // 10. String declarations: x = "..." or x = `...` - MUST have semicolon
                if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*["'`]/.test(trimmed)) {
                    return true;
                }

                // 11. Simple assignments (but not in object/flow literals with trailing comma)
                if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*[=]\s*[^=]/.test(trimmed) && !trimmed.endsWith(',')) {
                    // Skip if it's inside a flow/stock/states definition (has a colon before)
                    if (!trimmed.includes(':')) {
                        return true;
                    }
                }

                // 12. Increment/decrement operators - MUST have semicolon
                if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(\+\+|--)\s*$/.test(trimmed)) {
                    return true;
                }

                // 13. Parameter calls in state/run blocks: component.method() - MUST have semicolon
                if (/^\s*([a-zA-Z_][a-zA-Z0-9_]*|this)(\.[a-zA-Z_][a-zA-Z0-9_]*)+\s*(\([^)]*\))?\s*$/.test(trimmed)) {
                    return true;
                }

                // 14. State changes: advance(...), stay(), leave() - MUST have semicolon
                if (/^\s*(advance|stay|leave|choose)\s*\(/.test(trimmed) && trimmed.endsWith(')')) {
                    return true;
                }

                // 15. Init declarations: x = new Component - MUST have semicolon
                if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*new\s+/.test(trimmed)) {
                    return true;
                }

                // 16. Flow/arrow assignments: a -> b or a <- b - MUST have semicolon
                if (/(<-|->)/.test(trimmed)) {
                    return true;
                }

                return false;
            }
        },
        {
            id: 'invalid-flow-assignment',
            message: 'Flow assignments must use -> or <- operators',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*$/,
            validate: (match, line, lineNumber) => {
                const trimmed = line.trim();
                // Skip comments, definitions, and constants
                if (trimmed.startsWith('//') || trimmed.startsWith('/*') ||
                    trimmed.includes('const ') || trimmed.includes('def ') ||
                    trimmed.includes(':') || trimmed.includes('{') ||
                    trimmed.includes('spec ') || trimmed.includes('import ')) {
                    return false;
                }
                // Only flag if right side looks like a property access
                const rightSide = match[2];
                return rightSide.includes('.') && !trimmed.includes('"') && !trimmed.includes("'");
            }
        },
        {
            id: 'deprecated-syntax',
            message: 'This syntax is deprecated, consider using modern Fault syntax',
            severity: vscode.DiagnosticSeverity.Warning,
            pattern: /\b(old_keyword|legacy_syntax)\b/,
            validate: () => true
        },
        {
            id: 'missing-file-declaration',
            message: 'First line must be "system <filename>;" or "spec <filename>;" where <filename> matches the file name',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^(?:\/\/.*|\/\*[\s\S]*?\*\/|\s)*(?:(system|spec)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;)?/,
            validate: (match, line, lineNumber, document) => {
                // Only check the first non-comment, non-empty line
                if (lineNumber !== 0 && !document) {
                    return false;
                }

                if (!document) {
                    return false;
                }

                const text = document.getText();
                const lines = text.split('\n');

                // Find first non-comment, non-empty line
                let firstCodeLineIndex = -1;
                for (let i = 0; i < lines.length; i++) {
                    const trimmed = lines[i].trim();
                    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                        firstCodeLineIndex = i;
                        break;
                    }
                }

                // Only validate if this is the first code line
                if (lineNumber !== firstCodeLineIndex) {
                    return false;
                }

                const keyword = match[1];
                const declaredName = match[2];

                // Get filename without extension
                const path = require('path');
                const basename = path.basename(document.fileName);
                const fileNameWithoutExt = basename.replace(/\.(fspec|fsystem)$/, '');

                // Check if declaration is missing
                if (!keyword || !declaredName) {
                    return true; // Flag error: missing declaration
                }

                // Check if declared name matches filename
                if (declaredName !== fileNameWithoutExt) {
                    return true; // Flag error: name mismatch
                }

                // Check if declaration matches file type
                const extension = basename.endsWith('.fspec') ? 'spec' : 'system';
                if (keyword !== extension) {
                    return true; // Flag error: wrong keyword for file type
                }

                return false; // All checks passed
            }
        },
        // File-type restriction rules
        {
            id: 'wrong-file-type-global',
            message: 'global declarations can only be used in .fsystem files',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*global\s+[a-zA-Z_]/,
            validate: (match, line, lineNumber, document) => {
                if (!document) {
                    return false;
                }
                const basename = require('path').basename(document.fileName);
                // Flag error if this is in a .fspec file
                return basename.endsWith('.fspec');
            }
        },
        {
            id: 'wrong-file-type-component',
            message: 'component declarations can only be used in .fsystem files',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*component\s+[a-zA-Z_]/,
            validate: (match, line, lineNumber, document) => {
                if (!document) {
                    return false;
                }
                const basename = require('path').basename(document.fileName);
                // Flag error if this is in a .fspec file
                return basename.endsWith('.fspec');
            }
        },
        {
            id: 'wrong-file-type-start',
            message: 'start blocks can only be used in .fsystem files',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*start\s*\{/,
            validate: (match, line, lineNumber, document) => {
                if (!document) {
                    return false;
                }
                const basename = require('path').basename(document.fileName);
                // Flag error if this is in a .fspec file
                return basename.endsWith('.fspec');
            }
        },
        {
            id: 'wrong-file-type-def',
            message: 'def declarations (flow/stock) can only be used in .fspec files',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*(flow|stock)/,
            validate: (match, line, lineNumber, document) => {
                if (!document) {
                    return false;
                }
                const basename = require('path').basename(document.fileName);
                // Flag error if this is in a .fsystem file
                return basename.endsWith('.fsystem');
            }
        }
    ];

    public lint(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Check file declaration first (once per document)
        this.checkFileDeclaration(document, diagnostics);

        // Check for const reassignments
        this.checkConstReassignments(document, diagnostics);

        lines.forEach((line, lineNumber) => {
            this.rules.forEach(rule => {
                // Skip the file declaration rule since we handle it separately
                if (rule.id === 'missing-file-declaration') {
                    return;
                }

                if (rule.pattern.global) {
                    // Handle global regex patterns
                    rule.pattern.lastIndex = 0; // Reset global regex
                    let match;
                    while ((match = rule.pattern.exec(line)) !== null) {
                        if (!rule.validate || rule.validate(match, line, lineNumber, document)) {
                            const diagnostic = this.createDiagnostic(
                                document,
                                lineNumber,
                                match.index,
                                match[0].length,
                                rule.message,
                                rule.severity,
                                rule.id
                            );
                            diagnostics.push(diagnostic);
                        }
                    }
                } else {
                    // Handle non-global regex patterns
                    const match = line.match(rule.pattern);
                    if (match && (!rule.validate || rule.validate(match, line, lineNumber, document))) {
                        const diagnostic = this.createDiagnostic(
                            document,
                            lineNumber,
                            match.index || 0,
                            match[0].length,
                            rule.message,
                            rule.severity,
                            rule.id
                        );
                        diagnostics.push(diagnostic);
                    }
                }
            });
        });

        return this.filterDuplicates(diagnostics);
    }

    private checkFileDeclaration(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const text = document.getText();
        const lines = text.split('\n');

        // Find first non-comment, non-empty line
        let firstCodeLineIndex = -1;
        let firstCodeLine = '';
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                firstCodeLineIndex = i;
                firstCodeLine = trimmed;
                break;
            }
        }

        // If no code found, don't check
        if (firstCodeLineIndex === -1) {
            return;
        }

        // Get filename without extension
        const path = require('path');
        const basename = path.basename(document.fileName);
        const fileNameWithoutExt = basename.replace(/\.(fspec|fsystem)$/, '');

        // Check if first line has a system/spec declaration
        const declPattern = /^(system|spec)\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
        const match = firstCodeLine.match(declPattern);

        if (!match) {
            // Missing declaration
            const diagnostic = this.createDiagnostic(
                document,
                firstCodeLineIndex,
                0,
                firstCodeLine.length,
                'First line must be "system <filename>;" or "spec <filename>;" where <filename> matches the file name',
                vscode.DiagnosticSeverity.Error,
                'missing-file-declaration'
            );
            diagnostics.push(diagnostic);
            return;
        }

        const keyword = match[1];
        const declaredName = match[2];

        // Check if declared name matches filename
        if (declaredName !== fileNameWithoutExt) {
            const diagnostic = this.createDiagnostic(
                document,
                firstCodeLineIndex,
                match.index! + match[1].length + 1, // Start at the name
                declaredName.length,
                `Declaration name "${declaredName}" does not match filename "${fileNameWithoutExt}"`,
                vscode.DiagnosticSeverity.Error,
                'missing-file-declaration'
            );
            diagnostics.push(diagnostic);
            return;
        }

        // Check if declaration matches file type
        const expectedKeyword = basename.endsWith('.fspec') ? 'spec' : 'system';
        if (keyword !== expectedKeyword) {
            const diagnostic = this.createDiagnostic(
                document,
                firstCodeLineIndex,
                match.index!,
                keyword.length,
                `.${basename.endsWith('.fspec') ? 'fspec' : 'fsystem'} files must use "${expectedKeyword}" keyword, not "${keyword}"`,
                vscode.DiagnosticSeverity.Error,
                'missing-file-declaration'
            );
            diagnostics.push(diagnostic);
        }
    }

    private checkConstReassignments(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const text = document.getText();
        const lines = text.split('\n');

        // First pass: collect all const identifiers
        const constants = new Set<string>();
        const constPattern = /^\s*const\s+([a-zA-Z_][a-zA-Z0-9_]*)/;

        lines.forEach((line) => {
            const trimmed = line.trim();
            // Skip comments
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                return;
            }

            const match = trimmed.match(constPattern);
            if (match) {
                constants.add(match[1]);
            }
        });

        // Second pass: check for reassignments to constants
        const assignmentPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([+\-*/]?=)/;

        lines.forEach((line, lineNumber) => {
            const trimmed = line.trim();

            // Skip comments and const declarations themselves
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('const ')) {
                return;
            }

            const match = trimmed.match(assignmentPattern);
            if (match) {
                const identifier = match[1];
                const operator = match[2];

                // Check if this identifier is a constant
                if (constants.has(identifier)) {
                    const startIndex = line.indexOf(identifier);
                    const diagnostic = this.createDiagnostic(
                        document,
                        lineNumber,
                        startIndex,
                        identifier.length,
                        `Cannot reassign constant "${identifier}". Constants declared with 'const' are immutable.`,
                        vscode.DiagnosticSeverity.Error,
                        'const-reassignment'
                    );
                    diagnostics.push(diagnostic);
                }
            }
        });
    }

    private createDiagnostic(
        document: vscode.TextDocument,
        lineNumber: number,
        startChar: number,
        length: number,
        message: string,
        severity: vscode.DiagnosticSeverity,
        code: string
    ): vscode.Diagnostic {
        const range = new vscode.Range(
            lineNumber,
            startChar,
            lineNumber,
            startChar + length
        );

        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.code = code;
        diagnostic.source = 'fault-linter';
        return diagnostic;
    }

    private filterDuplicates(diagnostics: vscode.Diagnostic[]): vscode.Diagnostic[] {
        const seen = new Set<string>();
        return diagnostics.filter(diagnostic => {
            const key = `${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    public addRule(rule: LintRule): void {
        this.rules.push(rule);
    }

    public removeRule(ruleId: string): void {
        this.rules = this.rules.filter(rule => rule.id !== ruleId);
    }

    public getRules(): LintRule[] {
        return [...this.rules];
    }
}