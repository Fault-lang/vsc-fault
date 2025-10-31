# Fault Language Support

A Visual Studio Code extension that provides syntax highlighting and language support for the Fault specification language.

## Features

- **Syntax Highlighting**: Full syntax highlighting for Fault language constructs including:
  - Keywords (`system`, `component`, `spec`, `assert`, `assume`, etc.)
  - Types (`string`, `bool`, `int`, `float`, `natural`, `uncertain`, `unknown`)
  - Constants (`nil`, `true`, `false`, `now`)
  - Operators (assignment, logical, comparison, arithmetic)
  - Comments (line and block)
  - String literals (raw and interpreted)
  - Numeric literals (decimal, hex, octal, float)

- **Language Configuration**: 
  - Comment toggling (Ctrl+/ for line comments, Shift+Alt+A for block comments)
  - Bracket matching and auto-closing
  - Auto-indentation
  - Code folding

- **Linting and Error Detection**:
  - Real-time syntax validation with customizable rules
  - Missing semicolon detection
  - Invalid flow assignment detection (suggests using `->` or `<-`)
  - Undefined variable warnings
  - Type annotation suggestions
  - Deprecated syntax warnings
  - Configurable severity levels (error, warning, info, off)
  - Debounced linting for better performance

## Installation

1. Install the extension from the VS Code Marketplace
2. Open any `.fspec` or `.fsystem` file to see syntax highlighting in action

## File Association

This extension automatically provides syntax highlighting and linting for files with the `.fspec` and `.fsystem` extensions.

## Configuration

The linter can be customized through VS Code settings. Access settings via **File > Preferences > Settings** and search for "fault-linter".

### Available Settings

- `fault-linter.enabled`: Enable/disable the linter (default: true)
- `fault-linter.rules.missing-semicolon`: Severity for missing semicolon rule (default: error)
- `fault-linter.rules.invalid-flow-assignment`: Severity for flow assignment rule (default: error)
- `fault-linter.rules.undefined-variable`: Severity for undefined variable rule (default: warning)
- `fault-linter.rules.missing-type-annotation`: Severity for type annotation rule (default: info)
- `fault-linter.rules.deprecated-syntax`: Severity for deprecated syntax rule (default: warning)
- `fault-linter.debounceTime`: Delay in milliseconds before linting after changes (default: 500)

### Commands

- **Fault: Refresh Linting** - Manually refresh linting for all open Fault files
- **Fault: Clear Diagnostics** - Clear all linting diagnostics

## Development

To set up the development environment:

```bash
npm install
npm run compile
```

To package the extension:

```bash
npm install -g vsce
vsce package
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see LICENSE file for details.