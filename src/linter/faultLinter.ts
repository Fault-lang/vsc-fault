import * as vscode from 'vscode';

export interface LintRule {
    id: string;
    message: string;
    severity: vscode.DiagnosticSeverity;
    pattern: RegExp;
    validate?: (match: RegExpMatchArray, line: string, lineNumber: number) => boolean;
}

export class FaultLinter {
    private rules: LintRule[] = [
        // Syntax validation rules
        {
            id: 'missing-semicolon',
            message: 'Missing semicolon at end of statement',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^[^\/\*]*([=].*|[a-zA-Z_][a-zA-Z0-9_]*\s*\+\+|[a-zA-Z_][a-zA-Z0-9_]*\s*--)(?!.*[;}])\s*$/,
            validate: (match, line, lineNumber) => {
                const trimmed = line.trim();
                // Skip comments
                if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                    return false;
                }
                // Skip lines that are inside blocks or control structures
                if (trimmed.endsWith('{') || trimmed.endsWith('}') || 
                    trimmed.includes('then') || trimmed.includes('else') ||
                    trimmed.includes('spec ') || trimmed.includes('import ') ||
                    trimmed.includes('def ') || trimmed.includes('assert ') ||
                    trimmed.includes('assume ')) {
                    return false;
                }
                // Only flag simple assignment statements
                return /^[a-zA-Z_][a-zA-Z0-9_]*\s*[=]\s*[^=]/.test(trimmed) ||
                       /^[a-zA-Z_][a-zA-Z0-9_]*\s*(\+\+|--)\s*$/.test(trimmed);
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
            id: 'undefined-variable',
            message: 'Variable may be undefined',
            severity: vscode.DiagnosticSeverity.Warning,
            pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
            validate: (match, line, lineNumber) => {
                const trimmed = line.trim();
                // Skip comments completely
                if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                    return false;
                }
                
                const varName = match[1];
                // Extended list of keywords and common identifiers to skip
                const keywords = ['system', 'spec', 'component', 'def', 'const', 'if', 'else', 'then', 'when', 
                                'assert', 'assume', 'flow', 'stock', 'func', 'for', 'new', 'this', 'now',
                                'true', 'false', 'nil', 'int', 'float', 'string', 'bool', 'natural',
                                'import', 'eventually', 'always', 'advance', 'leave', 'stay', 'choose',
                                'global', 'start', 'states', 'run', 'init', 'return'];
                                
                // Skip if it's a keyword or defined in the same line
                return !keywords.includes(varName) && 
                       !line.includes('const ' + varName) && 
                       !line.includes('def ' + varName) && 
                       !line.includes(varName + ':') &&
                       !line.includes('spec ' + varName) &&
                       !line.includes('system ' + varName);
            }
        },
        {
            id: 'missing-type-annotation',
            message: 'Consider adding type annotation for better clarity',
            severity: vscode.DiagnosticSeverity.Information,
            pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^,}]+)(?![a-zA-Z])/,
            validate: (match, line, lineNumber) => {
                const value = match[2].trim();
                // Suggest type annotation for ambiguous values
                return /^[0-9]+$/.test(value) || /^[0-9]*\.[0-9]+$/.test(value) || 
                       value === 'true' || value === 'false';
            }
        },
        {
            id: 'deprecated-syntax',
            message: 'This syntax is deprecated, consider using modern Fault syntax',
            severity: vscode.DiagnosticSeverity.Warning,
            pattern: /\b(old_keyword|legacy_syntax)\b/,
            validate: () => true
        }
    ];

    public lint(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        lines.forEach((line, lineNumber) => {
            this.rules.forEach(rule => {
                if (rule.pattern.global) {
                    // Handle global regex patterns
                    rule.pattern.lastIndex = 0; // Reset global regex
                    let match;
                    while ((match = rule.pattern.exec(line)) !== null) {
                        if (!rule.validate || rule.validate(match, line, lineNumber)) {
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
                    if (match && (!rule.validate || rule.validate(match, line, lineNumber))) {
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