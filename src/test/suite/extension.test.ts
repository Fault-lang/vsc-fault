import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('fault-lang.fault-language-support'));
    });

    test('Should register fault language', async () => {
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('fault'));
    });

    test('Should activate extension', async () => {
        const extension = vscode.extensions.getExtension('fault-lang.fault-language-support');
        assert.ok(extension);
        
        if (!extension.isActive) {
            await extension.activate();
        }
        
        assert.ok(extension.isActive);
    });
});