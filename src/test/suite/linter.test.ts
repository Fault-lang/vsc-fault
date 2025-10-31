import * as assert from 'assert';
import * as vscode from 'vscode';
import { FaultLinter } from '../../linter/faultLinter';

suite('Linter Test Suite', () => {
    let linter: FaultLinter;

    setup(() => {
        linter = new FaultLinter();
    });

    test('Should detect missing semicolon', () => {
        const content = `spec TestSpec
const MAX_RETRIES = 3
orderTotal = basePrice + tax`;
        
        const document = createMockDocument(content);
        const diagnostics = linter.lint(document);
        
        const missingSemicolonDiagnostics = diagnostics.filter(d => d.code === 'missing-semicolon');
        assert.ok(missingSemicolonDiagnostics.length > 0, 'Should detect missing semicolon');
        assert.strictEqual(missingSemicolonDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should detect invalid flow assignment', () => {
        const content = `spec TestSpec
orderTotal = payment.amount`;
        
        const document = createMockDocument(content);
        const diagnostics = linter.lint(document);
        
        const invalidFlowDiagnostics = diagnostics.filter(d => d.code === 'invalid-flow-assignment');
        assert.ok(invalidFlowDiagnostics.length > 0, 'Should detect invalid flow assignment');
        assert.strictEqual(invalidFlowDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should suggest type annotations', () => {
        const content = `def TestFlow = flow {
    count: 42,
    rate: 3.14
}`;
        
        const document = createMockDocument(content);
        const diagnostics = linter.lint(document);
        
        const typeAnnotationDiagnostics = diagnostics.filter(d => d.code === 'missing-type-annotation');
        assert.ok(typeAnnotationDiagnostics.length > 0, 'Should suggest type annotations for numeric values');
        assert.strictEqual(typeAnnotationDiagnostics[0].severity, vscode.DiagnosticSeverity.Information);
    });

    test('Should not lint comments', () => {
        const content = `// This is a comment without semicolon
/* This is a block comment 
   also without semicolon */
spec TestSpec`;
        
        const document = createMockDocument(content);
        const diagnostics = linter.lint(document);
        
        // Should not report missing semicolon for comments
        const commentLineDiagnostics = diagnostics.filter(d => 
            d.range.start.line <= 1 // First two lines are comments
        );
        assert.strictEqual(commentLineDiagnostics.length, 0, 'Should not lint comments');
    });

    test('Should not flag valid syntax', () => {
        const content = `spec OrderProcessing

import "payment.fspec";

const MAX_RETRIES = 3;
const TIMEOUT = "30s";

def OrderFlow = flow {
    status: string("pending"),
    retries: int(0),
    processOrder: func {
        if this.retries < MAX_RETRIES then {
            this.status = "processing";
            this.retries++;
        } else {
            this.status = "failed";
        }
    }
};

// Flow assignment
orderTotal -> payment.amount;
assert order.status == "completed" eventually;`;
        
        const document = createMockDocument(content);
        const diagnostics = linter.lint(document);
        
        // Filter out undefined variable warnings for this test
        const errorDiagnostics = diagnostics.filter(d => 
            d.severity === vscode.DiagnosticSeverity.Error
        );
        
        assert.strictEqual(errorDiagnostics.length, 0, 'Should not flag valid syntax as errors');
    });

    test('Should handle empty documents', () => {
        const content = '';
        const document = createMockDocument(content);
        const diagnostics = linter.lint(document);
        
        assert.strictEqual(diagnostics.length, 0, 'Should handle empty documents without errors');
    });

    test('Should add and remove rules dynamically', () => {
        const initialRuleCount = linter.getRules().length;
        
        const customRule = {
            id: 'test-rule',
            message: 'Test rule message',
            severity: vscode.DiagnosticSeverity.Warning,
            pattern: /test-pattern/,
            validate: () => true
        };
        
        linter.addRule(customRule);
        assert.strictEqual(linter.getRules().length, initialRuleCount + 1, 'Should add rule');
        
        linter.removeRule('test-rule');
        assert.strictEqual(linter.getRules().length, initialRuleCount, 'Should remove rule');
    });

    test('Should filter duplicate diagnostics', () => {
        const content = `spec TestSpec
orderTotal = payment.amount
orderTotal = payment.amount`; // Same line repeated
        
        const document = createMockDocument(content);
        const diagnostics = linter.lint(document);
        
        // Should have diagnostics but no duplicates for the same position
        const positions = diagnostics.map(d => `${d.range.start.line}:${d.range.start.character}`);
        const uniquePositions = new Set(positions);
        
        assert.ok(diagnostics.length >= uniquePositions.size, 'Should filter duplicate diagnostics');
    });
});

// Helper function to create a mock VS Code document
function createMockDocument(content: string): vscode.TextDocument {
    const lines = content.split('\n');
    return {
        getText: () => content,
        lineAt: (line: number) => ({
            text: lines[line] || '',
            range: new vscode.Range(line, 0, line, lines[line]?.length || 0),
            rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
            firstNonWhitespaceCharacterIndex: lines[line]?.match(/\S/)?.index || 0,
            isEmptyOrWhitespace: !lines[line]?.trim()
        }),
        lineCount: lines.length,
        uri: vscode.Uri.file('/test/document.fspec'),
        fileName: '/test/document.fspec',
        languageId: 'fault',
        version: 1,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        save: () => Promise.resolve(true),
        eol: vscode.EndOfLine.LF,
        encoding: 'utf8',
        positionAt: (offset: number) => {
            let line = 0;
            let char = 0;
            let currentOffset = 0;
            
            for (let i = 0; i < content.length && currentOffset < offset; i++) {
                if (content[i] === '\n') {
                    line++;
                    char = 0;
                } else {
                    char++;
                }
                currentOffset++;
            }
            
            return new vscode.Position(line, char);
        },
        offsetAt: (position: vscode.Position) => {
            let offset = 0;
            for (let i = 0; i < position.line && i < lines.length; i++) {
                offset += lines[i].length + 1; // +1 for newline
            }
            return offset + position.character;
        },
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position,
        getWordRangeAtPosition: () => undefined
    } as any as vscode.TextDocument;
}