import * as vscode from 'vscode';

export interface FaultLinterConfig {
    enabled: boolean;
    rules: {
        'missing-semicolon': 'error' | 'warning' | 'info' | 'off';
        'invalid-flow-assignment': 'error' | 'warning' | 'info' | 'off';
        'undefined-variable': 'error' | 'warning' | 'info' | 'off';
        'missing-type-annotation': 'error' | 'warning' | 'info' | 'off';
        'deprecated-syntax': 'error' | 'warning' | 'info' | 'off';
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
                'undefined-variable': config.get('rules.undefined-variable', 'warning'),
                'missing-type-annotation': config.get('rules.missing-type-annotation', 'info'),
                'deprecated-syntax': config.get('rules.deprecated-syntax', 'warning')
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
}