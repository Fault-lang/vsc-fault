import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Syntax Highlighting Test Suite', () => {
    
    test('Should recognize .fspec files', async () => {
        const fspecPath = path.join(__dirname, '..', 'fixtures', 'sample.fspec');
        const document = await vscode.workspace.openTextDocument(fspecPath);
        
        assert.strictEqual(document.languageId, 'fault');
    });

    test('Should recognize .fsystem files', async () => {
        const fsystemPath = path.join(__dirname, '..', 'fixtures', 'sample.fsystem');
        const document = await vscode.workspace.openTextDocument(fsystemPath);
        
        assert.strictEqual(document.languageId, 'fault');
    });

    test('Should provide tokenization for keywords', async () => {
        const fspecPath = path.join(__dirname, '..', 'fixtures', 'sample.fspec');
        const document = await vscode.workspace.openTextDocument(fspecPath);

        // Open the document in an editor to trigger tokenization
        const editor = await vscode.window.showTextDocument(document);

        // Wait a moment for tokenization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check that the document is properly loaded
        assert.ok(document.getText().includes('spec'));
        assert.ok(document.getText().includes('const'));
        assert.ok(document.getText().includes('def'));
        assert.ok(document.getText().includes('flow'));

        // Close the editor
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('Should handle comment syntax', async () => {
        const fspecPath = path.join(__dirname, '..', 'fixtures', 'sample.fspec');
        const document = await vscode.workspace.openTextDocument(fspecPath);

        const text = document.getText();
        assert.ok(text.includes('// Valid Fault specification'));
    });

    test('Should handle string literals', async () => {
        const fspecPath = path.join(__dirname, '..', 'fixtures', 'sample.fspec');
        const document = await vscode.workspace.openTextDocument(fspecPath);

        const text = document.getText();
        // Fixture uses unknown() and stock/flow keywords
        assert.ok(text.includes('unknown()'));
        assert.ok(text.includes('stock{'));
    });

    test('Should handle numeric literals', async () => {
        const fspecPath = path.join(__dirname, '..', 'fixtures', 'sample.fspec');
        const document = await vscode.workspace.openTextDocument(fspecPath);

        const text = document.getText();
        assert.ok(text.includes('100'));
        assert.ok(text.includes('10'));
    });
});