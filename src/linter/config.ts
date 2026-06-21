import * as vscode from 'vscode';

export interface FaultLinterConfig {
    enabled: boolean;
    rules: {
        'missing-semicolon': 'error' | 'warning' | 'info' | 'off';
        'invalid-flow-assignment': 'error' | 'warning' | 'info' | 'off';
        'missing-file-declaration': 'error' | 'warning' | 'info' | 'off';
        'wrong-file-type-global': 'error' | 'warning' | 'info' | 'off';
        'wrong-file-type-component': 'error' | 'warning' | 'info' | 'off';
        'wrong-file-type-import': 'error' | 'warning' | 'info' | 'off';
        'wrong-file-type-def': 'error' | 'warning' | 'info' | 'off';
        'const-reassignment': 'error' | 'warning' | 'info' | 'off';
        'flow-scalar-property': 'error' | 'warning' | 'info' | 'off';
        'directional-operator-expression-rhs': 'error' | 'warning' | 'info' | 'off';
        'state-builtin-in-fspec': 'error' | 'warning' | 'info' | 'off';
        'unfalsifiable-assertion': 'error' | 'warning' | 'info' | 'off';
        'invalid-identifier': 'error' | 'warning' | 'info' | 'off';
        'when-then-temporal': 'error' | 'warning' | 'info' | 'off';
        'const-group-syntax': 'error' | 'warning' | 'info' | 'off';
        'import-in-fspec': 'error' | 'warning' | 'info' | 'off';
        'choose-misuse': 'error' | 'warning' | 'info' | 'off';
        'empty-func-body': 'error' | 'warning' | 'info' | 'off';
        'missing-run-block': 'error' | 'warning' | 'info' | 'off';
        'undeclared-stock-type': 'error' | 'warning' | 'info' | 'off';
        'identical-branch-calls': 'error' | 'warning' | 'info' | 'off';
        'missing-comma': 'error' | 'warning' | 'info' | 'off';
    };
    debounceTime: number;
}

export class ConfigManager {
    private static readonly CONFIG_SECTION = 'fault-linter';

    public static getConfig(): FaultLinterConfig {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        
        return {
            enabled: config.get<boolean>('enabled', true),
            rules: {
                'missing-semicolon': config.get('rules.missing-semicolon', 'error'),
                'invalid-flow-assignment': config.get('rules.invalid-flow-assignment', 'error'),
                'missing-file-declaration': config.get('rules.missing-file-declaration', 'error'),
                'wrong-file-type-global': config.get('rules.wrong-file-type-global', 'error'),
                'wrong-file-type-component': config.get('rules.wrong-file-type-component', 'error'),
                'wrong-file-type-import': config.get('rules.wrong-file-type-import', 'error'),
                'wrong-file-type-def': config.get('rules.wrong-file-type-def', 'error'),
                'const-reassignment': config.get('rules.const-reassignment', 'error'),
                'flow-scalar-property': config.get('rules.flow-scalar-property', 'error'),
                'directional-operator-expression-rhs': config.get('rules.directional-operator-expression-rhs', 'warning'),
                'state-builtin-in-fspec': config.get('rules.state-builtin-in-fspec', 'error'),
                'unfalsifiable-assertion': config.get('rules.unfalsifiable-assertion', 'warning'),
                'invalid-identifier': config.get('rules.invalid-identifier', 'error'),
                'when-then-temporal': config.get('rules.when-then-temporal', 'error'),
                'const-group-syntax': config.get('rules.const-group-syntax', 'error'),
                'import-in-fspec': config.get('rules.import-in-fspec', 'error'),
                'choose-misuse': config.get('rules.choose-misuse', 'error'),
                'empty-func-body': config.get('rules.empty-func-body', 'warning'),
                'missing-run-block': config.get('rules.missing-run-block', 'warning'),
                'undeclared-stock-type': config.get('rules.undeclared-stock-type', 'error'),
                'identical-branch-calls': config.get('rules.identical-branch-calls', 'warning'),
                'missing-comma': config.get('rules.missing-comma', 'error'),
            },
            debounceTime: config.get<number>('debounceTime', 500)
        };
    }

    public static severityFromString(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            case 'off': return vscode.DiagnosticSeverity.Hint; // Will be filtered out
            default: return vscode.DiagnosticSeverity.Warning;
        }
    }

    public static shouldRunRule(ruleName: string): boolean {
        const config = this.getConfig();
        const ruleSeverity = (config.rules as any)[ruleName];
        return ruleSeverity !== 'off';
    }

    public static severityFromConfig(ruleName: string): vscode.DiagnosticSeverity | undefined {
        const config = this.getConfig();
        const ruleSeverity = (config.rules as any)[ruleName];
        if (!ruleSeverity || ruleSeverity === 'off') {
            return undefined;
        }
        return this.severityFromString(ruleSeverity);
    }
}