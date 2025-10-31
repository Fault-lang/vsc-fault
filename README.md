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

## Installation

1. Install the extension from the VS Code Marketplace
2. Open any `.fspec` or `.fsystem` file to see syntax highlighting in action

## File Association

This extension automatically provides syntax highlighting for files with the `.fspec` and `.fsystem` extensions.

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