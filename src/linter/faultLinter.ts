import * as vscode from 'vscode';
import { ConfigManager } from './config';

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
                if (/^\s*system\s+[a-zA-Z][a-zA-Z0-9]*\s*$/.test(trimmed)) {
                    return true;
                }

                // 2. spec <name> - MUST have semicolon
                if (/^\s*spec\s+[a-zA-Z][a-zA-Z0-9]*\s*$/.test(trimmed)) {
                    return true;
                }

                // 3. import "..." - MUST have semicolon (but not if it ends with {})
                if (/^\s*import\s+/.test(trimmed) && !trimmed.endsWith(')')) {
                    return true;
                }

                // 4. global x = ... - MUST have semicolon
                if (/^\s*global\s+[a-zA-Z]/.test(trimmed)) {
                    return true;
                }

                // 5. const declarations - MUST have semicolon (but not if it's const (...))
                if (/^\s*const\s+[a-zA-Z]/.test(trimmed) && !trimmed.includes('(')) {
                    return true;
                }

                // 6. def X = flow/stock {...} - MUST have semicolon
                if (/^\s*def\s+[a-zA-Z][a-zA-Z0-9]*\s*=/.test(trimmed) && trimmed.endsWith('}')) {
                    return true;
                }

                // 7. component X = states {...} - MUST have semicolon
                if (/^\s*component\s+[a-zA-Z]/.test(trimmed) && trimmed.endsWith('}')) {
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

                // 10. String declarations: x = "..." - MUST have semicolon
                if (/^\s*[a-zA-Z][a-zA-Z0-9]*\s*=\s*["']/.test(trimmed)) {
                    return true;
                }

                // 11. Simple assignments (but not in object/flow literals with trailing comma)
                if (/^\s*[a-zA-Z][a-zA-Z0-9]*\s*[=]\s*[^=]/.test(trimmed) && !trimmed.endsWith(',')) {
                    // Skip if it's inside a flow/stock/states definition (has a colon before)
                    if (!trimmed.includes(':')) {
                        return true;
                    }
                }

                // 12. Increment/decrement operators - MUST have semicolon
                if (/^\s*[a-zA-Z][a-zA-Z0-9]*\s*(\+\+|--)\s*$/.test(trimmed)) {
                    return true;
                }

                // 13. Parameter calls in state/run blocks: component.method() - MUST have semicolon
                if (/^\s*([a-zA-Z][a-zA-Z0-9]*|this)(\.[a-zA-Z][a-zA-Z0-9]*)+\s*(\([^)]*\))?\s*$/.test(trimmed)) {
                    return true;
                }

                // 14. State changes: advance(...), stay(), leave() - MUST have semicolon
                if (/^\s*(advance|stay|leave|choose)\s*\(/.test(trimmed) && trimmed.endsWith(')')) {
                    return true;
                }

                // 15. Init declarations: x = new Component - MUST have semicolon
                if (/^\s*[a-zA-Z][a-zA-Z0-9]*\s*=\s*new\s+/.test(trimmed)) {
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
            pattern: /([a-zA-Z][a-zA-Z0-9]*)\s*=\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*$/,
            validate: (match, line, lineNumber, document) => {
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
                if (!rightSide.includes('.') || trimmed.includes('"') || trimmed.includes("'")) {
                    return false;
                }
                // Skip swap assignments inside init { } blocks
                if (document) {
                    const text = document.getText();
                    const lines = text.split('\n');
                    // Scan backwards from current line to detect if we're inside an init block
                    let braceDepth = 0;
                    for (let i = lineNumber; i >= 0; i--) {
                        const l = lines[i];
                        for (let c = (i === lineNumber ? line.length - 1 : l.length - 1); c >= 0; c--) {
                            if (l[c] === '}') { braceDepth++; }
                            else if (l[c] === '{') {
                                if (braceDepth > 0) { braceDepth--; }
                                else {
                                    // Check if this opening brace is part of an init block
                                    const prefix = l.substring(0, c).trim();
                                    if (/\binit\s*$/.test(prefix) || prefix === 'init') {
                                        return false; // inside init block, valid swap
                                    }
                                    return true;
                                }
                            }
                        }
                    }
                }
                return true;
            }
        },
        {
            id: 'missing-file-declaration',
            message: 'First line must be "system <filename>;" or "spec <filename>;" where <filename> matches the file name',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^(?:\/\/.*|\/\*[\s\S]*?\*\/|\s)*(?:(system|spec)\s+([a-zA-Z][a-zA-Z0-9]*)\s*;)?/,
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
            pattern: /^\s*global\s+[a-zA-Z]/,
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
            pattern: /^\s*component\s+[a-zA-Z]/,
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
            id: 'wrong-file-type-import',
            message: 'import can only be used in .fsystem files',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*import\s*\(/,
            validate: (match, line, lineNumber, document) => {
                if (!document) {
                    return false;
                }
                const basename = require('path').basename(document.fileName);
                return basename.endsWith('.fspec');
            }
        },
        {
            id: 'wrong-file-type-def',
            message: 'def declarations (flow/stock) can only be used in .fspec files',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*def\s+[a-zA-Z][a-zA-Z0-9]*\s*=\s*(flow|stock)/,
            validate: (match, line, lineNumber, document) => {
                if (!document) {
                    return false;
                }
                const basename = require('path').basename(document.fileName);
                return basename.endsWith('.fsystem');
            }
        },
        // ── High-priority rules ──────────────────────────────────────────────
        {
            id: 'const-group-syntax',
            message: 'Grouped const blocks are not valid Fault syntax. Declare each constant on its own line.',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*const\s*\(/,
            validate: () => true
        },
        {
            id: 'when-then-temporal',
            message: 'when/then invariants cannot have a temporal qualifier. Use a plain boolean expression instead (e.g. assert !A || B always;)',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /\bwhen\s+.+\s+then\b/,
            validate: (match, line) => {
                return /\b(always|eventually|eventually-always|nmt|nft|available)\b/.test(line);
            }
        },
        {
            id: 'state-builtin-in-fspec',
            message: 'stay(), advance(), and leave() are statechart builtins and are only valid inside .fsystem component state functions',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /\b(stay|advance|leave)\s*\(/,
            validate: (match, line, lineNumber, document) => {
                if (!document) { return true; }
                return require('path').basename(document.fileName).endsWith('.fspec');
            }
        },
        {
            id: 'invalid-identifier',
            message: 'Identifiers must be alphanumeric only (no underscores or hyphens). Use camelCase or PascalCase.',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /\b[a-zA-Z][a-zA-Z0-9]*[_\-][a-zA-Z0-9_\-]*\b/,
            validate: (match, line) => {
                const trimmed = line.trim();
                // Skip comments and string literals
                if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                    return false;
                }
                // Skip if the match is inside a string
                const matchIdx = line.indexOf(match[0]);
                const before = line.substring(0, matchIdx);
                const quoteCount = (before.match(/"/g) || []).length;
                return quoteCount % 2 === 0; // not inside a string
            }
        },
        {
            id: 'choose-misuse',
            message: 'choose requires two or more alternatives separated by ||, and may only apply to advance() or leave() calls',
            severity: vscode.DiagnosticSeverity.Error,
            pattern: /^\s*choose\s+/,
            validate: (match, line) => {
                const trimmed = line.trim();
                // Must have ||
                if (!trimmed.includes('||')) { return true; }
                // Must not use && with choose
                if (trimmed.includes('&&')) { return true; }
                // Each alternative must be advance(...), leave(...), or stay()
                // Strip "choose " prefix and trailing semicolon
                const chooseBody = trimmed.replace(/^choose\s+/, '').replace(/;$/, '').trim();
                const alternatives = chooseBody.split('||').map(s => s.trim());
                for (const alt of alternatives) {
                    if (!/^(advance\s*\(|leave\s*\(|stay\s*\()/.test(alt)) {
                        return true; // not a valid state transition call
                    }
                }
                return false;
            }
        },
        {
            id: 'empty-func-body',
            message: 'func{} body is empty and has no effect',
            severity: vscode.DiagnosticSeverity.Warning,
            pattern: /\bfunc\s*\{\s*\}/,
            validate: () => true
        },
    ];

    public lint(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Check file declaration first (once per document)
        this.checkFileDeclaration(document, diagnostics);

        // Check for const reassignments
        this.checkConstReassignments(document, diagnostics);

        // Multi-line / stateful checks
        this.checkFlowScalarProperties(document, diagnostics);
        this.checkDirectionalOperatorRHS(document, diagnostics);
        this.checkUnfalsifiableAssertions(document, diagnostics);
        this.checkMissingRunBlock(document, diagnostics);
        this.checkUndeclaredStockTypes(document, diagnostics);
        this.checkIdenticalBranchCalls(document, diagnostics);
        this.checkEmptyFuncBodyMultiline(document, diagnostics);
        this.checkMissingCommas(document, diagnostics);

        lines.forEach((line, lineNumber) => {
            this.rules.forEach(rule => {
                // Skip the file declaration rule since we handle it separately
                if (rule.id === 'missing-file-declaration') {
                    return;
                }

                // Respect per-rule configuration (enabled/severity)
                if (!ConfigManager.shouldRunRule(rule.id)) {
                    return;
                }
                const configuredSeverity = ConfigManager.severityFromConfig(rule.id);
                const effectiveSeverity = configuredSeverity ?? rule.severity;

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
                                effectiveSeverity,
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
                            effectiveSeverity,
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
        const declPattern = /^(system|spec)\s+([a-zA-Z][a-zA-Z0-9]*)/;
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
        // Use lenient pattern here: const-reassignment is about immutability, not naming.
        // The invalid-identifier rule handles naming separately.
        const constPattern = /^\s*const\s+([a-zA-Z][a-zA-Z0-9_]*)/;

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

        // Second pass: check for reassignments to constants (lenient ident pattern to match underscore names too)
        const assignmentPattern = /^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*([+\-*/]?=)/;

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
                // Skip if the identifier is followed by '.' — it's a field access, not a reassignment
                const afterIdent = trimmed.slice(identifier.length).trimStart();
                if (afterIdent.startsWith('.')) {
                    return;
                }

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

    private checkFlowScalarProperties(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('flow-scalar-property')) { return; }
        const severity = ConfigManager.severityFromConfig('flow-scalar-property') ?? vscode.DiagnosticSeverity.Error;
        const text = document.getText();
        const lines = text.split('\n');

        let inFlowBlock = false;
        let flowBraceDepth = 0;

        lines.forEach((line, lineNumber) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) { return; }

            // Detect entering a flow block: "= flow{"
            if (/=\s*flow\s*\{/.test(trimmed)) {
                inFlowBlock = true;
                flowBraceDepth = 1;
                return;
            }

            if (inFlowBlock) {
                for (const ch of trimmed) {
                    if (ch === '{') { flowBraceDepth++; }
                    else if (ch === '}') { flowBraceDepth--; }
                }
                if (flowBraceDepth <= 0) {
                    inFlowBlock = false;
                    return;
                }
                // Only check at depth 1 (direct flow properties, not nested func bodies)
                if (flowBraceDepth === 1) {
                    // A flow property line: "name: <value>,"
                    // Valid values: new StockType, func{, unfunc{, extends, exclude
                    const propMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+),?\s*$/);
                    if (propMatch) {
                        const value = propMatch[2].trim().replace(/,$/, '').trim();
                        const isValid = /^new\s+/.test(value) ||
                            /^func\s*\{/.test(value) ||
                            /^unfunc\s*\{/.test(value) ||
                            /^extends\s+/.test(value) ||
                            /^exclude\s+/.test(value);
                        if (!isValid) {
                            const startChar = line.indexOf(propMatch[0]);
                            diagnostics.push(this.createDiagnostic(
                                document, lineNumber, startChar, propMatch[0].length,
                                `Scalar value in flow property "${propMatch[1]}". Flow properties must be "new StockType", "func{}", or "unfunc{}". Use a const for fixed values.`,
                                severity, 'flow-scalar-property'
                            ));
                        }
                    }
                }
            }
        });
    }

    private checkDirectionalOperatorRHS(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('directional-operator-expression-rhs')) { return; }
        const severity = ConfigManager.severityFromConfig('directional-operator-expression-rhs') ?? vscode.DiagnosticSeverity.Error;
        const text = document.getText();
        const lines = text.split('\n');

        lines.forEach((line, lineNumber) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) { return; }

            const dirMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\s*(->|<-)\s*(.+?)\s*;?\s*$/);
            if (!dirMatch) { return; }

            const lhs = dirMatch[1];
            const rhs = dirMatch[3];

            // Allow simple literals: number (optionally negative), identifier, constant ref
            // Flag if RHS contains arithmetic operators beyond a leading unary minus
            const rhsStripped = rhs.replace(/^-/, ''); // allow unary minus
            if (/[+\-*\/]/.test(rhsStripped)) {
                const startChar = line.indexOf(dirMatch[0]);
                diagnostics.push(this.createDiagnostic(
                    document, lineNumber, startChar, dirMatch[0].length,
                    `The RHS of "${dirMatch[2]}" must be a plain delta value, not an arithmetic expression. Use "${lhs} ${dirMatch[2]} amount;" where amount is a literal or constant.`,
                    severity, 'directional-operator-expression-rhs'
                ));
                return;
            }
            // Flag if RHS references the same base identifier as LHS
            const lhsBase = lhs.split('.')[0];
            if (new RegExp(`\\b${lhsBase}\\b`).test(rhs)) {
                const startChar = line.indexOf(dirMatch[0]);
                diagnostics.push(this.createDiagnostic(
                    document, lineNumber, startChar, dirMatch[0].length,
                    `The RHS of "${dirMatch[2]}" must be a plain delta, not an expression referencing the target. Use "${lhs} ${dirMatch[2]} amount;" instead.`,
                    severity, 'directional-operator-expression-rhs'
                ));
            }
        });
    }

    private checkUnfalsifiableAssertions(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('unfalsifiable-assertion')) { return; }
        const severity = ConfigManager.severityFromConfig('unfalsifiable-assertion') ?? vscode.DiagnosticSeverity.Warning;
        const text = document.getText();
        const lines = text.split('\n');

        const assumedExprs = new Set<string>();

        lines.forEach((line, lineNumber) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) { return; }

            const assumeMatch = trimmed.match(/^assume\s+(.+?)\s*;/);
            if (assumeMatch) {
                assumedExprs.add(assumeMatch[1].trim());
                return;
            }

            const assertMatch = trimmed.match(/^assert\s+(.+?)\s*;/);
            if (assertMatch) {
                // Strip optional temporal qualifier from the end
                const expr = assertMatch[1]
                    .replace(/\s+(always|eventually|eventually-always|nmt\s+\d+|nft\s+\d+|available)\s*$/, '')
                    .trim();
                if (assumedExprs.has(expr)) {
                    const startChar = line.indexOf('assert');
                    diagnostics.push(this.createDiagnostic(
                        document, lineNumber, startChar, trimmed.length,
                        `Unfalsifiable assertion: "${expr}" is already assumed. The solver will never find a violation.`,
                        severity, 'unfalsifiable-assertion'
                    ));
                }
            }
        });
    }

    private checkMissingRunBlock(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('missing-run-block')) { return; }
        const basename = require('path').basename(document.fileName);
        if (!basename.endsWith('.fspec')) { return; }
        const severity = ConfigManager.severityFromConfig('missing-run-block') ?? vscode.DiagnosticSeverity.Warning;
        const text = document.getText().trim();
        if (!text) { return; } // skip empty documents
        const lines = text.split('\n');

        // Only flag if the file has a spec declaration (i.e. it's a real .fspec, not just being written)
        const hasSpecDecl = lines.some(line => /^\s*spec\s+/.test(line));
        if (!hasSpecDecl) { return; }

        const hasRunBlock = lines.some(line => /^\s*run\b/.test(line));
        if (!hasRunBlock) {
            const lastLine = Math.max(0, lines.length - 1);
            diagnostics.push(this.createDiagnostic(
                document, lastLine, 0, lines[lastLine].length || 1,
                '.fspec file has no run block. The solver has nothing to execute.',
                severity, 'missing-run-block'
            ));
        }
    }

    private checkUndeclaredStockTypes(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('undeclared-stock-type')) { return; }
        const severity = ConfigManager.severityFromConfig('undeclared-stock-type') ?? vscode.DiagnosticSeverity.Error;
        const text = document.getText();
        const lines = text.split('\n');
        const basename = require('path').basename(document.fileName);

        // Collect all declared def names (stocks and flows)
        const declaredTypes = new Set<string>();
        lines.forEach(line => {
            const m = line.match(/^\s*def\s+([a-zA-Z][a-zA-Z0-9]*)\s*=/);
            if (m) { declaredTypes.add(m[1]); }
        });

        lines.forEach((line, lineNumber) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) { return; }

            const newMatches = [...trimmed.matchAll(/\bnew\s+([a-zA-Z][a-zA-Z0-9]*)\b/g)];
            newMatches.forEach(typeMatch => {
                const typeName = typeMatch[1];
                const token = typeMatch[0];
                // In .fsystem, alias.Type qualified names are valid — check for qualified form in context
                if (basename.endsWith('.fsystem')) {
                    // If the preceding character in the line is '.', this is a qualified type
                    const tokenIdx = line.indexOf(token);
                    const beforeToken = line.substring(0, tokenIdx).trimEnd();
                    if (beforeToken.endsWith('.')) { return; }
                }
                if (!declaredTypes.has(typeName)) {
                    const startChar = line.indexOf(token);
                    diagnostics.push(this.createDiagnostic(
                        document, lineNumber, startChar, token.length,
                        `"${typeName}" is not a declared type. Add "def ${typeName} = stock{ ... };" or "def ${typeName} = flow{ ... };" before using it.`,
                        severity, 'undeclared-stock-type'
                    ));
                }
            });
        });
    }

    private checkIdenticalBranchCalls(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('identical-branch-calls')) { return; }
        const severity = ConfigManager.severityFromConfig('identical-branch-calls') ?? vscode.DiagnosticSeverity.Warning;
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length - 2; i++) {
            const ifLine = lines[i].trim();
            // Look for "if <cond> { <call>; }"  single-line style
            const ifSingle = ifLine.match(/^if\s+.+\{\s*([^{}]+)\s*\}$/);
            if (!ifSingle) { continue; }
            // Check next non-empty line for "else { <call>; }"
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) { j++; }
            const elseLine = lines[j]?.trim() || '';
            const elseSingle = elseLine.match(/^else\s*\{\s*([^{}]+)\s*\}$/);
            if (!elseSingle) { continue; }
            const ifBody = ifSingle[1].trim().replace(/;$/, '');
            const elseBody = elseSingle[1].trim().replace(/;$/, '');
            if (ifBody === elseBody && ifBody.length > 0) {
                const startChar = lines[i].indexOf('if');
                diagnostics.push(this.createDiagnostic(
                    document, i, startChar, ifLine.length,
                    `Both branches call the same function "${ifBody}". This gives the solver no additional paths to explore.`,
                    severity, 'identical-branch-calls'
                ));
            }
        }
    }

    private checkEmptyFuncBodyMultiline(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('empty-func-body')) { return; }
        const severity = ConfigManager.severityFromConfig('empty-func-body') ?? vscode.DiagnosticSeverity.Warning;
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
            const trimmed = lines[i].trim();
            if (/\bfunc\s*\{$/.test(trimmed) || /\bunfunc\s*\{$/.test(trimmed)) {
                // Check if next non-empty line is just a closing brace
                let j = i + 1;
                while (j < lines.length && !lines[j].trim()) { j++; }
                if (lines[j]?.trim() === '}' || lines[j]?.trim() === '},') {
                    const startChar = lines[i].indexOf('func');
                    const keyword = /\bunfunc\b/.test(trimmed) ? 'unfunc' : 'func';
                    diagnostics.push(this.createDiagnostic(
                        document, i, startChar, trimmed.length,
                        `${keyword}{} body is empty and has no effect`,
                        severity, 'empty-func-body'
                    ));
                }
            }
        }
    }

    private checkMissingCommas(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        if (!ConfigManager.shouldRunRule('missing-comma')) { return; }
        const severity = ConfigManager.severityFromConfig('missing-comma') ?? vscode.DiagnosticSeverity.Error;
        const text = document.getText();
        const lines = text.split('\n');

        let inBlock = false;
        let blockDepth = 0;

        lines.forEach((line, lineNumber) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) { return; }

            if (!inBlock) {
                // Detect opening of a stock or flow block
                if (/=\s*(stock|flow)\s*\{/.test(trimmed)) {
                    inBlock = true;
                    blockDepth = 1;
                }
                return;
            }

            // Track brace depth changes on this line
            const depthBefore = blockDepth;
            for (const ch of trimmed) {
                if (ch === '{') { blockDepth++; }
                else if (ch === '}') { blockDepth--; }
            }

            // Closing line of the block itself (depth went to 0) — not a property line
            if (blockDepth <= 0) {
                inBlock = false;
                blockDepth = 0;
                return;
            }

            if (depthBefore === 1 && blockDepth === 1) {
                // Direct property line with no nested braces opened or closed
                // Needs a trailing comma if it's a property declaration
                const isPropLine = /^[a-zA-Z]/.test(trimmed); // starts with an identifier
                const opensNested = trimmed.endsWith('{');     // "fill: func{" style
                if (isPropLine && !opensNested && !trimmed.endsWith(',')) {
                    const endChar = line.trimEnd().length;
                    diagnostics.push(this.createDiagnostic(
                        document, lineNumber, endChar, 1,
                        'Missing trailing comma. Stock and flow property lines must end with ",".',
                        severity, 'missing-comma'
                    ));
                }
            } else if (depthBefore === 2 && blockDepth === 1) {
                // Closing of a nested func/unfunc block back to property level
                // The closing "}" needs a trailing comma: "},"
                if (trimmed === '}') {
                    const endChar = line.indexOf('}') + 1;
                    diagnostics.push(this.createDiagnostic(
                        document, lineNumber, endChar - 1, 1,
                        'Missing trailing comma after closing brace. func/unfunc blocks inside a flow must end with "},".',
                        severity, 'missing-comma'
                    ));
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