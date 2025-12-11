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

## Draft Rules
1. Semicolon rules (the ones you hinted at)
1.1. Require ; after these:


system <name>;


spec <name>;


every import ...;


global x = ...; and every swap that follows it (x.y = 5;)


def Foo = flow { ... }; / def Foo = stock { ... };


component X = states{ ... };


start { ... };


top-level assert ...; and assume ...;


string declarations like str1 = "something";


const-like decls if you add them


each statement in a state{ ... } or run{ ... } that is not an if-form, e.g.


advance(this.foo);


choose cond;


a.b.c; (param call step)




1.2. Forbid ; after these:


if ... { ... } blocks (in state blocks, run blocks, or normal blocks)


else { ... }


nested blocks generally (func { ... }) unless the grammar explicitly wants ... } eos (top-level constructs do).


1.3. Normalize the odd one:
for 2 run { ... } is eos? in the grammar—pick a style:


either “always require ; after for ... run { ... }”, or


“never allow ; after for ... run { ... }”.


(Your example files seem to omit it, so I’d codify “no semicolon after for ... run { ... }.)

2. Trailing-comma rules (Fault’s grammar actually wants them)
The grammar uses the pattern (... ',')* '}', which requires a trailing comma. So you can have a rule:
2.1. Must have a trailing comma in:


component state lists:
component x = states{
    foo: func{ ... },
    bar: func{ ... },
};



start { ... } blocks:
start {
    x: foo,
};



struct/flow/stock definitions:
def meter = flow{
    capacity: 10,
    active: true,
    tick: func{ ... },
};



2.2. Forbid trailing commas everywhere else, e.g. argument lists if you ever add them, import without parens, etc.
2.3. Require comma between entries in those same places (i.e. no missing commas in states{ ... }).

3. Block & brace style
3.1. Opening brace on the same line as the keyword, to match the samples:
component x = states{

not
component x = states
{

3.2. Closing brace on its own line (except for tiny one-liners you might want to allow).
3.3. else cuddling:
}else{ appears in the samples—decide if you want to enforce that (}else{) or the spaced version (} else {). Make it a rule either way so projects don’t diverge.
3.4. Always use braces for if/else inside state{} and run{} to avoid ambiguous multi-step lines.

4. Indentation / whitespace
Pick a house style (2 or 4 spaces) and then:


Indent blocks inside states{}:


component


each state


block inside state




Indent if bodies inside state/run blocks


Space after commas in maps: x: foo, and in start { a: b, }


Spaces around binary operators: a && b, a || b, x + y


No space before ;



5. Imports
From the grammar:
import "../simple.fspec";

So linter rules:


Require quotes around import paths.


Disallow unused imports.


Disallow duplicate imports.


Require imports to appear right after system ...; / spec ...;.


If you ever use the import ( ... ) form, require a trailing comma inside to match the rest of the language.



6. Top-level ordering
Very handy in a linter:


system ...; or spec ...; (exactly one per file)


import ...; (0+)


global ...; (0+)


component ... = states{ ... }; (0+)


start { ... }; (0 or 1)


for ... run { ... } (0 or 1)


Assertions / assumptions at the end (optional)


Flag anything out of order.

7. Component/state rules
7.1. Unique state names in a states{ ... } block.
7.2. State bodies must be func{ ... } (the grammar wants stateLit = 'func' stateBlock), so flag anything else.
7.3. Empty state blocks (func{}) can be warned on.
7.4. Disallow states without trailing comma (see §2).
**7.5. In start { ... }, each component should appear at most once, and referenced state must exist in that component.
7.6. In start { ... }, require at least one mapping.

8. State-step / run-step rules (the interesting Fault bits)
From the grammar:
stateStep
    : paramCall ('|' paramCall)? eos
    | 'choose'? boolExpression eos
    | stateChange eos
    | ifStmtState
    ;

So you can say:


If the step is an if, it must not end with ;.


If the step is not an if, it must end with ;.


Piped calls (a.b() | a.c()) must have spaces around |.


Disallow more than one | if you want to keep things simple (grammar currently allows 0 or 1 – so linter can enforce “max 1 pipe in a state step”).


Disallow blank steps (;) inside state/run blocks.



9. Built-in state-change calls
Grammar says:
stateChange
    : ('advance' | 'leave') '(' paramCall ')'
    | ('stay' | 'leave') '(' ')'
    ;

So add:


advance and the 1-arg leave must have exactly 1 paramCall – no expressions, no literals.


stay() and 0-arg leave() must have empty parens – flag stay; or stay ( ) ; weird spacing.


No extra args in any built-in call.


Optionally: don’t allow mixing advance(...) && advance(...) without parentheses in a step—i.e. require parentheses when combining built-ins with &&/|| inside a state block.



10. Boolean-expression style in states
Because state steps can be like:
advance(this.a) || (advance(this.b) && advance(this.c));

you can add:


Require spaces around && and ||.


Require parentheses when mixing && and ||.


Forbid constant booleans in state steps (true; / false;) unless it’s under choose.



11. Struct / flow / stock rules
From the grammar:
structType
    : 'flow' '{' (sfProperties ',')* '}'
    | 'stock' '{' (sfProperties ',')* '}'
    ;

So:


Require trailing comma on every property (see §2).


Disallow duplicate property names.


Enforce order: plain properties first, function properties (IDENT: func{...},) last.


Forbid empty flow/stock (since grammar allows { } via ()*, but it may be useless).


Require space after colon in properties: name: value,.



12. Assertions / assumptions
Grammar:
assert a = b;
assume (a && b) || c;

So:


Require ; (already in §1).


Warn when using assignment-like = between two non-identifiers inside assert—people might have meant ==.


For when ... then ... invariants, require parentheses around complex sides.



13. Globals & new
We saw:
global fl = new simple.fl;
...
init x = new Some.Component;

So:


Require semicolon after global ... and after every following swap.


Warn on unused globals.


Enforce format of new: new IDENT or new IDENT.IDENT (that’s what the grammar allows).


Disallow new in places where only an identifier is valid (e.g. start mappings).



14. Naming conventions (style, not grammar)
Pick defaults:


systems/specs/components/globals: lower_snake or lowerCamel; but be consistent within a file


states inside states{}: lower_snake


types/defs (def MyThing): PascalCase


Linter can:


Check that names don’t start with _.


Check that names don’t shadow keywords (system, states, advance, ...).


Check that qualified names (a.b.c) don’t have uppercase if you want to stay consistent with existing examples.



15. File-type rules
Because you have .fspec and .fsystem:


.fspec files must start with spec ...;


.fsystem files must start with system ...;


Disallow component ... in .fspec (if that’s your design)


Disallow assert/assume at top of .fsystem unless you specifically allow global checks



16. “Correctness-ish” checks (nice to have)


states referenced in start { comp: state, } must exist


components referenced in start must exist


for N run { ... }: N must be a positive integer


detect unreachable states in a component (can be a linter pass)


detect cycles that only call stay() (could be a warning)



17. Comment rules


// must have a space after it


no trailing whitespace


no block comments inside states{} if you want to keep formatting simple



TL;DR starter set
If you want a minimum viable Fault linter right now:


Semicolons: enforce everywhere the grammar has eos and forbid after if/else.


Trailing commas: require in states{}, start {}, and flow{}/stock{}.


Block style: { on same line, } else { normalized.


Top-level order: system → import → global → component → start → for run.


State/run steps: non-if steps must end with ;.


Built-ins: advance(...)/stay() must have correct arity and parens.


That’ll already catch most real-world “why won’t Fault parse / why does this look different from the examples?” issues.