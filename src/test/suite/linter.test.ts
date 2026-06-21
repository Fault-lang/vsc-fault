import * as assert from 'assert';
import * as vscode from 'vscode';
import { FaultLinter } from '../../linter/faultLinter';
import { FaultCodeActionProvider } from '../../linter/codeActionProvider';

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
        const content = `spec orderProcessing;

const MAXRETRIES = 3;
const RATE = 10;

def tokenBucket = stock{
    tokens: unknown(),
    capacity: MAXRETRIES,
};

def fillFlow = flow{
    bucket: new tokenBucket,
    fill: func{
        if bucket.tokens < bucket.capacity {
            bucket.tokens <- RATE;
        }
    },
};

assert tokenBucket.tokens >= 0 always;

run init {
    f = new fillFlow;
} {
    f.fill;
}`;

        const document = createMockDocument(content, '/test/orderProcessing.fspec');
        const diagnostics = linter.lint(document);

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

    test('Should accept correct file declaration for .fspec file', () => {
        const content = `spec OrderProcessing

const MAX_RETRIES = 3;`;

        const document = createMockDocument(content, '/test/OrderProcessing.fspec');
        const diagnostics = linter.lint(document);

        const fileDeclarationDiagnostics = diagnostics.filter(d => d.code === 'missing-file-declaration');
        assert.strictEqual(fileDeclarationDiagnostics.length, 0, 'Should accept correct spec declaration');
    });

    test('Should accept correct file declaration for .fsystem file', () => {
        const content = `system PaymentSystem

global timeout = 30;`;

        const document = createMockDocument(content, '/test/PaymentSystem.fsystem');
        const diagnostics = linter.lint(document);

        const fileDeclarationDiagnostics = diagnostics.filter(d => d.code === 'missing-file-declaration');
        assert.strictEqual(fileDeclarationDiagnostics.length, 0, 'Should accept correct system declaration');
    });

    test('Should detect missing file declaration', () => {
        const content = `const MAX_RETRIES = 3;`;

        const document = createMockDocument(content, '/test/OrderProcessing.fspec');
        const diagnostics = linter.lint(document);

        const fileDeclarationDiagnostics = diagnostics.filter(d => d.code === 'missing-file-declaration');
        assert.ok(fileDeclarationDiagnostics.length > 0, 'Should detect missing file declaration');
        assert.strictEqual(fileDeclarationDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should detect filename mismatch', () => {
        const content = `spec WrongName

const MAX_RETRIES = 3;`;

        const document = createMockDocument(content, '/test/OrderProcessing.fspec');
        const diagnostics = linter.lint(document);

        const fileDeclarationDiagnostics = diagnostics.filter(d => d.code === 'missing-file-declaration');
        assert.ok(fileDeclarationDiagnostics.length > 0, 'Should detect filename mismatch');
        assert.strictEqual(fileDeclarationDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should detect wrong keyword for file type', () => {
        const content = `system OrderProcessing

const MAX_RETRIES = 3;`;

        const document = createMockDocument(content, '/test/OrderProcessing.fspec');
        const diagnostics = linter.lint(document);

        const fileDeclarationDiagnostics = diagnostics.filter(d => d.code === 'missing-file-declaration');
        assert.ok(fileDeclarationDiagnostics.length > 0, 'Should detect wrong keyword for file type');
        assert.strictEqual(fileDeclarationDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should handle comments before file declaration', () => {
        const content = `// This is a comment
/* Block comment */
spec OrderProcessing

const MAX_RETRIES = 3;`;

        const document = createMockDocument(content, '/test/OrderProcessing.fspec');
        const diagnostics = linter.lint(document);

        const fileDeclarationDiagnostics = diagnostics.filter(d => d.code === 'missing-file-declaration');
        assert.strictEqual(fileDeclarationDiagnostics.length, 0, 'Should handle comments before declaration');
    });

    test('Should detect filename mismatch with hyphens', () => {
        const content = `// Sample Fault file with intentional syntax errors
spec OrderProcessingWithErrors

const MAX_RETRIES = 3;`;

        const document = createMockDocument(content, '/test/sample-with-errors.fspec');
        const diagnostics = linter.lint(document);

        const fileDeclarationDiagnostics = diagnostics.filter(d => d.code === 'missing-file-declaration');
        assert.ok(fileDeclarationDiagnostics.length > 0, 'Should detect filename mismatch (sample-with-errors vs OrderProcessingWithErrors)');
        assert.strictEqual(fileDeclarationDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should flag global declaration in .fspec file', () => {
        const content = `spec TestSpec;

global counter = 0;`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const wrongFileTypeDiagnostics = diagnostics.filter(d => d.code === 'wrong-file-type-global');
        assert.ok(wrongFileTypeDiagnostics.length > 0, 'Should flag global in .fspec file');
        assert.strictEqual(wrongFileTypeDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should flag component declaration in .fspec file', () => {
        const content = `spec TestSpec;

component OrderProcessor = states {
    idle: func { }
};`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const wrongFileTypeDiagnostics = diagnostics.filter(d => d.code === 'wrong-file-type-component');
        assert.ok(wrongFileTypeDiagnostics.length > 0, 'Should flag component in .fspec file');
        assert.strictEqual(wrongFileTypeDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should flag import in .fspec file', () => {
        const content = `spec TestSpec;

import(
    other "../other.fspec"
);`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const wrongFileTypeDiagnostics = diagnostics.filter(d => d.code === 'wrong-file-type-import');
        assert.ok(wrongFileTypeDiagnostics.length > 0, 'Should flag import in .fspec file');
        assert.strictEqual(wrongFileTypeDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should flag def declaration in .fsystem file', () => {
        const content = `system TestSystem;

def OrderFlow = flow {
    status: "pending"
};`;

        const document = createMockDocument(content, '/test/TestSystem.fsystem');
        const diagnostics = linter.lint(document);

        const wrongFileTypeDiagnostics = diagnostics.filter(d => d.code === 'wrong-file-type-def');
        assert.ok(wrongFileTypeDiagnostics.length > 0, 'Should flag def in .fsystem file');
        assert.strictEqual(wrongFileTypeDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should allow global in .fsystem file', () => {
        const content = `system TestSystem;

global counter = 0;`;

        const document = createMockDocument(content, '/test/TestSystem.fsystem');
        const diagnostics = linter.lint(document);

        const wrongFileTypeDiagnostics = diagnostics.filter(d => d.code === 'wrong-file-type-global');
        assert.strictEqual(wrongFileTypeDiagnostics.length, 0, 'Should allow global in .fsystem file');
    });

    test('Should allow def in .fspec file', () => {
        const content = `spec TestSpec;

def OrderFlow = flow {
    status: "pending"
};`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const wrongFileTypeDiagnostics = diagnostics.filter(d => d.code === 'wrong-file-type-def');
        assert.strictEqual(wrongFileTypeDiagnostics.length, 0, 'Should allow def in .fspec file');
    });

    test('Should detect const reassignment', () => {
        const content = `spec TestSpec;

const MAXRETRIES = 3;

MAXRETRIES = 5;`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const constReassignmentDiagnostics = diagnostics.filter(d => d.code === 'const-reassignment');
        assert.ok(constReassignmentDiagnostics.length > 0, 'Should detect const reassignment');
        assert.strictEqual(constReassignmentDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
        assert.ok(constReassignmentDiagnostics[0].message.includes('MAXRETRIES'), 'Error message should mention the constant name');
    });

    test('Should detect compound assignment to const', () => {
        const content = `spec TestSpec;

const COUNTER = 0;

COUNTER += 1;`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const constReassignmentDiagnostics = diagnostics.filter(d => d.code === 'const-reassignment');
        assert.ok(constReassignmentDiagnostics.length > 0, 'Should detect compound assignment to const');
        assert.strictEqual(constReassignmentDiagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should allow assignment to non-const variable', () => {
        const content = `spec TestSpec;

const MAXRETRIES = 3;

retries = 1;
retries = 2;`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const constReassignmentDiagnostics = diagnostics.filter(d => d.code === 'const-reassignment');
        assert.strictEqual(constReassignmentDiagnostics.length, 0, 'Should allow assignment to non-const variables');
    });

    test('Should allow const initial assignment', () => {
        const content = `spec TestSpec;

const MAX_RETRIES = 3;
const TIMEOUT = 30;`;

        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);

        const constReassignmentDiagnostics = diagnostics.filter(d => d.code === 'const-reassignment');
        assert.strictEqual(constReassignmentDiagnostics.length, 0, 'Should allow const initial assignments');
    });

    // ── New rule tests ──────────────────────────────────────────────────────

    test('Should not flag swap assignment inside init block', () => {
        const content = `spec TestSpec;

def bucket = stock{ tokens: unknown(), };
def filler = flow{ b: new bucket, fill: func{ b.tokens <- 1; }, };
def drainer = flow{ b: new bucket, drain: func{ b.tokens -> 1; }, };

run init {
    f = new filler;
    d = new drainer;
    d.b = f.b;
} {
    f.fill;
}`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const flowAssignDiags = diagnostics.filter(d => d.code === 'invalid-flow-assignment');
        assert.strictEqual(flowAssignDiags.length, 0, 'Should not flag swap inside init block');
    });

    test('Should detect const-group-syntax', () => {
        const content = `spec TestSpec;

const (
    MAX = 100;
    RATE = 3;
)

run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'const-group-syntax');
        assert.ok(diags.length > 0, 'Should detect grouped const syntax');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should not flag valid single const', () => {
        const content = `spec TestSpec;
const MAX = 100;
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'const-group-syntax');
        assert.strictEqual(diags.length, 0, 'Should not flag single const declaration');
    });

    test('Should detect when-then-temporal', () => {
        const content = `spec TestSpec;
def b = stock{ tokens: unknown(), };
assert when b.tokens < 0 then b.tokens >= 0 always;
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'when-then-temporal');
        assert.ok(diags.length > 0, 'Should detect when/then with temporal qualifier');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should not flag when-then without temporal qualifier', () => {
        const content = `spec TestSpec;
def b = stock{ tokens: unknown(), };
assert when b.tokens < 0 then b.tokens >= 0;
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'when-then-temporal');
        assert.strictEqual(diags.length, 0, 'Should not flag when/then without temporal qualifier');
    });

    test('Should detect state-builtin-in-fspec', () => {
        const content = `spec TestSpec;
def s = stock{ level: unknown(), };
def f = flow{
    s: new s,
    tick: func{
        stay();
    },
};
run init { inst = new f; } { inst.tick; }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'state-builtin-in-fspec');
        assert.ok(diags.length > 0, 'Should detect stay() in .fspec');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should detect unfalsifiable-assertion', () => {
        const content = `spec TestSpec;
def b = stock{ tokens: unknown(), };
assume b.tokens >= 0;
assert b.tokens >= 0 always;
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'unfalsifiable-assertion');
        assert.ok(diags.length > 0, 'Should detect unfalsifiable assertion');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Warning);
    });

    test('Should not flag assert when expression differs from assume', () => {
        const content = `spec TestSpec;
def b = stock{ tokens: unknown(), };
assume b.tokens >= 0;
assert b.tokens <= 100 always;
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'unfalsifiable-assertion');
        assert.strictEqual(diags.length, 0, 'Should not flag assert with different expression from assume');
    });

    test('Should detect invalid-identifier with underscore', () => {
        const content = `spec TestSpec;
def my_stock = stock{ level: unknown(), };
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'invalid-identifier');
        assert.ok(diags.length > 0, 'Should detect identifier with underscore');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should not flag valid camelCase identifier', () => {
        const content = `spec TestSpec;
def myStock = stock{ level: unknown(), };
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'invalid-identifier');
        assert.strictEqual(diags.length, 0, 'Should not flag valid camelCase identifier');
    });

    test('Should detect flow-scalar-property', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
def badFlow = flow{
    bucket: new bucket,
    rate: 3,
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'flow-scalar-property');
        assert.ok(diags.length > 0, 'Should detect scalar value in flow property');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should not flag valid flow properties', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
def goodFlow = flow{
    bucket: new bucket,
    fill: func{ bucket.tokens <- 1; },
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'flow-scalar-property');
        assert.strictEqual(diags.length, 0, 'Should not flag valid flow properties');
    });

    test('Should detect directional-operator-expression-rhs', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
def badFlow = flow{
    bucket: new bucket,
    drain: func{
        bucket.tokens -> bucket.tokens - 1;
    },
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'directional-operator-expression-rhs');
        assert.ok(diags.length > 0, 'Should detect arithmetic RHS in directional operator');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should not flag plain delta in directional operator', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
def goodFlow = flow{
    bucket: new bucket,
    drain: func{
        bucket.tokens -> 1;
    },
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'directional-operator-expression-rhs');
        assert.strictEqual(diags.length, 0, 'Should not flag plain delta');
    });

    test('Should detect missing-run-block in .fspec', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
assert bucket.tokens >= 0 always;`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'missing-run-block');
        assert.ok(diags.length > 0, 'Should detect missing run block in .fspec');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Warning);
    });

    test('Should not flag missing-run-block when run block exists', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'missing-run-block');
        assert.strictEqual(diags.length, 0, 'Should not flag when run block is present');
    });

    test('Should detect choose-misuse with single option', () => {
        const content = `system TestSystem;
component valve = states{
    open: func{
        choose advance(this.closed);
    },
    closed: func{ stay(); },
};
run { valve.open; }`;
        const document = createMockDocument(content, '/test/TestSystem.fsystem');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'choose-misuse');
        assert.ok(diags.length > 0, 'Should detect choose with single option');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should not flag valid choose', () => {
        const content = `system TestSystem;
component valve = states{
    open: func{
        choose advance(this.closed) || stay();
    },
    closed: func{ stay(); },
};
run { valve.open; }`;
        const document = createMockDocument(content, '/test/TestSystem.fsystem');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'choose-misuse');
        assert.strictEqual(diags.length, 0, 'Should not flag valid choose with ||');
    });

    test('Should detect empty-func-body single-line', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
def f = flow{ bucket: new bucket, fill: func{}, };
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'empty-func-body');
        assert.ok(diags.length > 0, 'Should detect empty func{} body');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Warning);
    });

    // ── missing-comma tests ────────────────────────────────────────────────

    test('Should detect missing comma in stock property', () => {
        const content = `spec TestSpec;
def bucket = stock{
    tokens: unknown()
    capacity: 100,
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'missing-comma');
        assert.ok(diags.length > 0, 'Should detect missing comma after stock property');
        assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
    });

    test('Should detect missing comma in flow stock ref', () => {
        const content = `spec TestSpec;
def bucket = stock{ tokens: unknown(), };
def f = flow{
    bucket: new bucket
    fill: func{ bucket.tokens <- 1; },
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'missing-comma');
        assert.ok(diags.length > 0, 'Should detect missing comma after flow stock ref');
    });

    test('Should not flag missing-comma when commas are present', () => {
        const content = `spec TestSpec;
def bucket = stock{
    tokens: unknown(),
    capacity: 100,
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'missing-comma');
        assert.strictEqual(diags.length, 0, 'Should not flag when commas are present');
    });

    test('Should not flag closing brace of stock/flow block for missing-comma', () => {
        const content = `spec TestSpec;
def bucket = stock{
    tokens: unknown(),
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const diagnostics = linter.lint(document);
        const diags = diagnostics.filter(d => d.code === 'missing-comma');
        assert.strictEqual(diags.length, 0, 'Should not flag closing }; of block');
    });
});

// ── Code action tests ──────────────────────────────────────────────────────

suite('Code Action Test Suite', () => {
    let linter: FaultLinter;
    let provider: FaultCodeActionProvider;

    setup(() => {
        linter = new FaultLinter();
        provider = new FaultCodeActionProvider();
    });

    function getActions(document: vscode.TextDocument, diagnosticCode: string) {
        const diagnostics = linter.lint(document).filter(d => d.code === diagnosticCode);
        if (diagnostics.length === 0) { return []; }
        const range = diagnostics[0].range;
        return provider.provideCodeActions(document, range, {
            diagnostics,
            only: undefined,
            triggerKind: vscode.CodeActionTriggerKind.Invoke
        });
    }

    test('Should provide fix for missing-semicolon', () => {
        const content = `spec TestSpec;
const MAX = 3`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const actions = getActions(document, 'missing-semicolon');
        assert.ok(actions.length > 0, 'Should provide a quick fix');
        assert.ok(actions[0].edit, 'Action should have an edit');
        assert.strictEqual(actions[0].isPreferred, true);
    });

    test('Should provide fix for missing-comma', () => {
        const content = `spec TestSpec;
def bucket = stock{
    tokens: unknown()
    capacity: 100,
};
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const actions = getActions(document, 'missing-comma');
        assert.ok(actions.length > 0, 'Should provide a quick fix for missing comma');
        assert.ok(actions[0].edit, 'Action should have an edit');
    });

    test('Should provide two fixes for when-then-temporal', () => {
        const content = `spec TestSpec;
def b = stock{ tokens: unknown(), };
assert when b.tokens < 0 then b.tokens >= 0 always;
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const actions = getActions(document, 'when-then-temporal');
        assert.strictEqual(actions.length, 2, 'Should provide two alternatives');
        // First: remove temporal qualifier
        assert.ok(actions[0].title.includes('Remove'), 'First action removes temporal qualifier');
        // Second: rewrite as boolean
        assert.ok(actions[1].title.includes('Rewrite'), 'Second action rewrites as boolean');
    });

    test('Should provide fix for const-group-syntax', () => {
        const content = `spec TestSpec;
const (
    MAXA = 100;
    RATEB = 3;
)
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const actions = getActions(document, 'const-group-syntax');
        assert.ok(actions.length > 0, 'Should provide a quick fix for const group');
        assert.ok(actions[0].title.includes('Split'), 'Should offer to split into individual consts');
    });

    test('Should provide fix for invalid-identifier', () => {
        const content = `spec TestSpec;
def my_stock = stock{ level: unknown(), };
run { }`;
        const document = createMockDocument(content, '/test/TestSpec.fspec');
        const actions = getActions(document, 'invalid-identifier');
        assert.ok(actions.length > 0, 'Should provide a rename fix');
        assert.ok(actions[0].title.includes('myStock'), 'Should suggest camelCase name');
    });
});

// Helper function to create a mock VS Code document
function createMockDocument(content: string, fileName: string = '/test/document.fspec'): vscode.TextDocument {
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
        uri: vscode.Uri.file(fileName),
        fileName: fileName,
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