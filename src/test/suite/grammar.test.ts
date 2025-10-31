import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Grammar Test Suite', () => {
    
    test('Grammar file should exist', () => {
        const grammarPath = path.join(__dirname, '../../../syntaxes/fault.tmLanguage.json');
        assert.ok(fs.existsSync(grammarPath), 'Grammar file should exist');
    });

    test('Grammar should have valid JSON structure', () => {
        const grammarPath = path.join(__dirname, '../../../syntaxes/fault.tmLanguage.json');
        const grammarContent = fs.readFileSync(grammarPath, 'utf8');
        
        let grammar;
        assert.doesNotThrow(() => {
            grammar = JSON.parse(grammarContent);
        }, 'Grammar should be valid JSON');

        assert.ok(grammar.name, 'Grammar should have a name');
        assert.ok(grammar.scopeName, 'Grammar should have a scopeName');
        assert.ok(grammar.patterns, 'Grammar should have patterns');
        assert.ok(grammar.repository, 'Grammar should have a repository');
    });

    test('Grammar should include all required patterns', () => {
        const grammarPath = path.join(__dirname, '../../../syntaxes/fault.tmLanguage.json');
        const grammarContent = fs.readFileSync(grammarPath, 'utf8');
        const grammar = JSON.parse(grammarContent);

        const requiredPatterns = [
            'comments',
            'keywords', 
            'types',
            'strings',
            'numbers',
            'operators',
            'punctuation',
            'identifiers'
        ];

        requiredPatterns.forEach(pattern => {
            assert.ok(
                grammar.repository[pattern], 
                `Grammar should include ${pattern} pattern`
            );
        });
    });

    test('Keywords pattern should include Fault language keywords', () => {
        const grammarPath = path.join(__dirname, '../../../syntaxes/fault.tmLanguage.json');
        const grammarContent = fs.readFileSync(grammarPath, 'utf8');
        const grammar = JSON.parse(grammarContent);

        const keywordPatterns = grammar.repository.keywords.patterns;
        const keywordRegex = keywordPatterns[0].match;
        
        // Check for essential Fault keywords
        const essentialKeywords = [
            'system', 'spec', 'component', 'assert', 'assume',
            'def', 'flow', 'stock', 'states', 'func'
        ];

        essentialKeywords.forEach(keyword => {
            assert.ok(
                keywordRegex.includes(keyword),
                `Keywords pattern should include '${keyword}'`
            );
        });
    });

    test('File types should include .fspec and .fsystem', () => {
        const grammarPath = path.join(__dirname, '../../../syntaxes/fault.tmLanguage.json');
        const grammarContent = fs.readFileSync(grammarPath, 'utf8');
        const grammar = JSON.parse(grammarContent);

        assert.ok(grammar.fileTypes.includes('fspec'), 'Should include .fspec files');
        assert.ok(grammar.fileTypes.includes('fsystem'), 'Should include .fsystem files');
    });
});