# Fault Language Syntax Reference

Fault is a formal modeling language for verifying system behavior using stock-flow models and statecharts. Specifications are checked by an SMT solver (Z3) against assertions that describe invariants or goals.

There are two file types:
- **`.fspec`** — defines stocks, flows, assertions, and a run block
- **`.fsystem`** — defines a statechart that imports and orchestrates `.fspec` components

---

## General Rules

### Identifiers

All names — spec names, stock names, flow names, field names, function names, variable names, constant names — must be **alphanumeric only**: letters and digits, no underscores, no hyphens.

Use camelCase or PascalCase for multi-word names.

```
// VALID
spec tokenBucket;
def refillRate = stock{ ... };
def fillFlow = flow{ ... };

// INVALID — underscores and hyphens are forbidden
spec token_bucket;
def refill-rate = stock{ ... };
```

### Comments

```
// single-line comment

/* multi-line
   comment */
```

### Semicolons

Every top-level statement ends with `;`. Closing braces of `if`/`else` blocks do not take a semicolon. See each construct below for specifics.

---

## `.fspec` File Structure

```
spec <name>;

[const <NAME> = <value>;]
[def <name> = stock{ ... };]
[def <name> = flow{ ... };]
[assert <invariant> [<temporal>];]
[assume <invariant> [<temporal>];]

run [init { <init steps> }] {
    <run steps>
}
```

The file **must** begin with `spec <name>;` where `<name>` matches the filename without extension.

`.fspec` files **cannot** use `import`, `global`, or `component`. Those are `.fsystem`-only.

---

## Constants

```
const MAXCAPACITY = 100;
const RATE = 3;
const FLAG = true;
```

Each constant is declared on its own line with `const`. The **grouped form is not valid**:

```
// INVALID — grouped const block
const (
    MAXCAPACITY = 100;
    RATE = 3;
)
```

Constants can be referenced directly inside `func{}` bodies and assertion expressions.

---

## Stocks

Stocks are **passive** containers. They hold state but perform no computation.

```
def <name> = stock{
    <field>: <value>,
    ...
};
```

Every property line ends with a comma. The closing `};` ends the definition.

### Field Value Types

| Value | Meaning |
|---|---|
| `unknown()` | Solver-controlled; continuous search space. Use for levels, rates, balances. |
| `whole()` | Solver-controlled integer. Use for discrete counts, indexes, queue depths. |
| `uncertain(mean, sigma)` | Probabilistic float near a mean. |
| `10`, `-3`, `3.14` | Fixed integer or float literal. |
| `true`, `false` | Fixed boolean literal. |
| `"hello"` | String literal. |
| `fieldName,` | Bare identifier with no value — implicitly `unknown()`. |

```
def tokenBucket = stock{
    tokens: unknown(),
    capacity: 100,
    active: false,
    label,
};
```

### Stock Inheritance

```
def base = stock{
    level: unknown(),
    capacity: 100,
};

def child = stock{
    extends base,
    exclude capacity,
    ownField: unknown(),
};
```

- `extends <stockName>` — inherits all fields from the named stock
- `exclude <fieldName>` — removes an inherited field; only inherited fields can be excluded

---

## Flows

Flows are **active** components that transform stocks.

```
def <name> = flow{
    <stockRef>: new <StockType>,
    <funcName>: func{
        <statements>
    },
};
```

### Flow Property Rules (Critical)

**Flow properties may ONLY be:**
1. `name: new StockType` — a stock reference
2. `name: func{ ... }` — a function body
3. `name: unfunc{ ... }` — an uninterpreted function body

**Scalar values are forbidden in flow definitions.** `rate: 3` or `active: false` as a flow property will panic the compiler at runtime. If you need a constant threshold, declare it with `const` and reference it inside a `func{}` body.

```
// VALID
def filler = flow{
    bucket: new tokenBucket,
    fill: func{
        bucket.tokens <- RATE;
    },
};

// INVALID — scalar values in flow properties cause a compiler panic
def filler = flow{
    bucket: new tokenBucket,
    rate: 3,           // WRONG: scalar value in flow
    active: true,      // WRONG: scalar value in flow
};
```

### Statements Inside `func{}` Bodies

```
target.field <- amount;      // increment field by amount (fill)
target.field -> amount;      // decrement field by amount (drain)
target.field = value;        // reset field to value
target.field++;              // postfix increment
target.field--;              // postfix decrement
if expr { ... } else { ... } // conditional
target.field[0]              // index into prior-round values
```

`this` refers to the current flow instance: `this.bucket.tokens`.

Every statement ends with `;`. The `if`/`else` block itself does not.

### Directional Operator Rules (Critical)

`<-` and `->` take a **delta** (the amount to add or subtract), not a new value and not an expression involving the target.

```
// VALID
tokens -> 1;             // decrement by 1
tokens <- RATE;          // increment by RATE constant
tokens = capacity;       // reset to capacity (= is allowed for reset)

// INVALID — arithmetic expression as delta
tokens -> tokens - 1;    // WRONG: do not reference the target on the RHS
tokens <- tokens + RATE; // WRONG: do not put arithmetic expressions as delta
```

### State Machine Builtins are Forbidden in `.fspec`

`stay()`, `advance()`, and `leave()` are statechart builtins. They are **only valid inside `.fsystem` component state functions**. Using them inside a `.fspec` flow `func{}` is an error.

```
// INVALID in .fspec
def valve = flow{
    state: new valveState,
    tick: func{
        stay();       // WRONG: not valid in .fspec
        advance(this.open);  // WRONG: not valid in .fspec
    },
};
```

---

## Uninterpreted Functions (`unfunc`)

Used when behavior is specified declaratively rather than procedurally.

```
def <name> = flow{
    <stockRef>: new <StockType>,
    <funcName>: unfunc{
        requires <boolean-expression>,
        emits <emission> [, <emission>, ...],
    },
};
```

### Emission Forms

```
target                    // bare (implicitly true)
!target                   // negation
target = boolValue        // boolean assignment
target = arithmeticExpr   // numeric assignment
target <- amount          // fill
target -> amount          // drain
```

---

## Assertions and Assumptions

```
assert <invariant> [<temporal>];
assume <invariant> [<temporal>];
```

### Invariant Forms

```
// Direct boolean expression
assert tokens >= 0;
assert depth > 0 && depth <= capacity;

// Named invariant
assert nonNegative = tokens >= 0;

// Conditional implication (when/then)
assume when user.subscribed then user.authenticated;
assert when queue.empty then !processor.running;
```

`when/then` **cannot** be combined with a temporal qualifier. Use a plain boolean expression if you need a temporal qualifier.

```
// INVALID — when/then with temporal qualifier
assert when A then B always;   // WRONG

// VALID — use plain boolean expression for temporal
assert !A || B always;         // equivalent, valid
```

### Temporal Qualifiers

Appended after the invariant, before the `;`:

| Qualifier | Meaning |
|---|---|
| `always` | Must hold at every step |
| `eventually` | Must hold at some step |
| `eventually-always` | Must reach a state and remain there |
| `nmt <N>` | No more than N occurrences |
| `nft <N>` | No fewer than N occurrences |
| `available` | Value produced or emitted at least once (used with `unfunc`) |

```
assert tokens >= 0 always;
assert queue.depth == 0 eventually;
assert counter > 0 nmt 3;
```

### Assertion vs. Assumption Modes

- **Verification mode**: use `assert` only. The solver searches for violations.
- **Simulation mode**: use `assume` only. The solver finds a satisfying assignment.

Do not assert what you have already assumed — asserting the same expression that appears in an `assume` is unfalsifiable.

```
// INVALID — unfalsifiable pair
assume tokens >= 0;
assert tokens >= 0 always;  // solver assumed this; will never find a violation
```

### Equality in Assertions

Use `==` for equality comparisons inside invariant expressions. `=` is assignment syntax and is not valid inside `assert`/`assume` expressions (except in named invariant form `name = expr`).

```
assert order.status == "completed" eventually;  // VALID
assert order.status = "completed" eventually;   // INVALID
```

---

## Run Block (`.fspec`)

```
run [init {
    <name> = new <FlowType>;
    [<name>.<stockRef> = <otherFlow>.<stockRef>;]
}] {
    <instance>.<funcName>;
    [<instance>.<funcName> | <instance>.<funcName>;]
    [if expr { ... }]
    [__;]
}
```

### Init Block

The `init` block instantiates flow instances and sets up swaps. It contains only:
- `varName = new FlowType;` — create a flow instance
- `flowB.stockRef = flowA.stockRef;` — swap (share a stock instance between flows)

```
run init {
    drawn = new faucet;
    pipe = new drain;
    pipe.water = drawn.water;   // swap: both flows share the same tub instance
} {
    ...
}
```

### Swaps

A swap links two flow instances to the same stock at runtime. Without it, each flow instance operates on its own independent stock copy.

```
// flowB.stockRef = flowA.stockRef;
pipe.water = drawn.water;
```

Both sides must reference stock properties of the same type. A stock cannot be swapped more than once.

### Run Body Steps

```
drawn.in;                          // call a single function
drawn.in | pipe.out;               // parallel / nondeterministic (one fires)
drawn.in && pipe.out;              // simultaneous (both fire in same step)
if drawn.water.level < 50 {        // conditional branch
    drawn.in;
}
__;                                // synthesis placeholder (solver chooses)
```

### Synthesis Mode

In synthesis mode the run body contains only `__;` placeholders. The solver chooses which flow function fires at each step to satisfy goal assertions.

```
run init {
    f = new filler;
    d = new drainer;
    d.pool = f.pool;
} {
    __;
    __;
    __;
}
```

---

## `.fsystem` File Structure

```
system <name>;

[import( <alias> "<path/to/file.fspec>" );]
[global <name> = new <alias>.<FlowType>;]
[component <name> = states{ ... };]
[assert <invariant> [<temporal>];]
[assume <invariant> [<temporal>];]

run {
    <component>.<initialState>;
    [further steps]
}
```

The file **must** begin with `system <name>;` where `<name>` matches the filename without extension.

---

## Imports (`.fsystem` only)

```
import(
    pump "../pump.fspec"
    limiter "./ratelimiter.fspec"
);
```

- The alias before the path must match the `spec <name>;` declaration in the imported file
- Multiple files can be listed inside a single `import()` block
- Each entry is on its own line with the alias and path separated by a space (no comma between entries)

---

## Globals (`.fsystem` only)

Global flow instances are available to all component states.

```
global p = new pump.pumper;
global fill = new limiter.fillFlow;
```

Format: `global <name> = new <importAlias>.<FlowType>;`

### Referencing Globals in Assertions

In `.fsystem` assert/assume statements, reference stock values through a flow instance global — not through the spec-qualified type:

```
// VALID in .fsystem assert/assume
assert fill.bucket.tokens >= 0 always;

// INVALID in .fsystem — spec-qualified type is not in scope
assert ratelimiter.tokenBucket.tokens >= 0 always;
```

In `.fspec` assert/assume statements, referencing the stock type directly is valid and preferred:

```
// VALID in .fspec assert/assume — applies to all instances of tokenBucket
assert tokenBucket.tokens >= 0 always;
```

---

## Components and States (`.fsystem` only)

```
component <name> = states{
    <stateName>: func{
        <state body>
    },
    ...
};
```

Each state is a `func{}` block. Every state entry ends with a comma. The closing `};` ends the component.

### State Body Rules (Critical)

**Component state functions cannot modify stocks directly.** All stock mutation must go through a global flow function call. State functions may only:
1. Call global flow functions: `globalFlow.funcName;`
2. Read stock values in `if` conditions
3. Execute state transitions: `advance()`, `stay()`, `leave()`

```
// VALID state body
processing: func{
    p.pump;                         // call global flow function
    if p.tank.level < 10 {
        advance(this.idle);
    } else {
        stay();
    }
},

// INVALID — direct stock mutation in a state body
processing: func{
    p.tank.level -> 1;   // WRONG: cannot mutate stock directly in a state
},
```

### State Transition Builtins

```
advance(this.stateName)    // transition to stateName
stay()                     // remain in current state
leave()                    // exit current state
```

### Combining Transitions

```
advance(this.a) && advance(this.b)    // both transitions (AND)
advance(this.a) || advance(this.b)    // one transition (OR, nondeterministic)
choose advance(this.a) || advance(this.b)   // explicit nondeterministic choice
choose advance(this.a) || stay()           // choose with stay
```

### `choose` Rules

- `choose` requires `||` between two or more alternatives
- **Cannot** be used with a single option: `choose advance(this.a);` is invalid
- **Cannot** be used with `&&`
- **Can only** apply to `advance()` and `leave()` calls — not to flow function calls

```
// VALID
choose advance(this.approved) || advance(this.rejected);
choose advance(this.open) || stay();

// INVALID
choose advance(this.a);                      // single option
choose advance(this.a) && advance(this.b);   // && with choose
choose p.fill || p.drain;                    // flow calls with choose
```

### `this` Reference

`this.stateName` is only valid inside component state functions. It is not valid in `.fspec` flow functions.

---

## Run Block (`.fsystem`)

The run block sets the initial state of each component by calling the first state function for that component.

```
run {
    valve.closed;
    request.pending;
}
```

There is no separate `init` block in `.fsystem`. Globals are instantiated at the `global` declaration.

---

## Complete Examples

### `.fspec` — Token Bucket Rate Limiter

```
spec ratelimiter;

const MAXCAPACITY = 100;

def tokenBucket = stock{
    tokens: unknown(),
    capacity: MAXCAPACITY,
};

def fillFlow = flow{
    bucket: new tokenBucket,
    fill: func{
        if bucket.tokens < bucket.capacity {
            bucket.tokens <- 10;
        }
    },
};

def consumeFlow = flow{
    bucket: new tokenBucket,
    consume: func{
        bucket.tokens -> 1;
    },
};

assert tokenBucket.tokens >= 0 always;
assert tokenBucket.tokens <= MAXCAPACITY always;

run init {
    fill = new fillFlow;
    consume = new consumeFlow;
    consume.bucket = fill.bucket;
} {
    if fill.bucket.tokens < MAXCAPACITY {
        fill.fill;
    }
    if consume.bucket.tokens > 0 {
        consume.consume;
    }
}
```

### `.fspec` — Budget with Spending

```
spec budget;

def account = stock{
    balance,
};

def spender = flow{
    funds: new account,
    spend: func{
        funds.balance -> 50;
    },
};

assume account.balance < 200;
assert account.balance >= 0 always;

run init {
    s = new spender;
} {
    if s.funds.balance > 0 {
        s.spend;
    }
}
```

### `.fsystem` — Valve Control

```
system valveControl;

import(
    pump "../pump.fspec"
);

global p = new pump.pumper;

component valve = states{
    closed: func{
        if p.pressure > 80 {
            advance(this.open);
        } else {
            stay();
        }
    },
    open: func{
        p.release;
        if p.pressure < 20 {
            advance(this.closed);
        } else {
            stay();
        }
    },
};

assert fill.bucket.tokens >= 0 always;

run {
    valve.closed;
}
```

### `.fsystem` — Nondeterministic Choice

```
system router;

component request = states{
    pending: func{
        choose advance(this.approved) || advance(this.rejected);
    },
    approved: func{
        stay();
    },
    rejected: func{
        stay();
    },
};

run {
    request.pending;
}
```

---

## Common Mistakes

| Mistake | Correct form |
|---|---|
| `rate: 3` in a `flow{}` | Use `const RATE = 3;` and reference `RATE` inside `func{}` |
| `tokens -> tokens - 1;` | `tokens -> 1;` — RHS is a delta, not an expression |
| `stay()` inside a `.fspec` flow func | Remove it; omit the else branch or leave it empty |
| `const (A = 1; B = 2;)` | One `const` declaration per line |
| `assert when A then B always;` | `assert !A \|\| B always;` — `when/then` has no temporal qualifier |
| `choose advance(this.a);` | `choose advance(this.a) \|\| stay();` — needs two alternatives |
| `assume x >= 0; assert x >= 0;` | Remove the `assert`; asserting an assumption is unfalsifiable |
| `if cond { f.foo; } else { f.foo; }` | Branches must call different functions |
| `ratelimiter.tokenBucket.tokens` in `.fsystem` assert | `fill.bucket.tokens` — reference through a global flow instance |
| `my_name` or `my-name` as an identifier | `myName` — alphanumeric only, camelCase |

---

## Keyword Reference

### `.fspec` Keywords

`spec`, `const`, `def`, `stock`, `flow`, `func`, `unfunc`, `new`, `this`, `assert`, `assume`, `run`, `init`, `if`, `else`, `when`, `then`, `extends`, `exclude`, `requires`, `emits`

### `.fsystem` Keywords

All `.fspec` keywords plus: `system`, `import`, `global`, `component`, `states`, `advance`, `stay`, `leave`, `choose`

### Type Keywords

`unknown`, `whole`, `uncertain`, `natural`, `string`, `bool`, `int`, `float`, `param`

### Temporal Keywords

`always`, `eventually`, `eventually-always`, `nmt`, `nft`, `available`

### Literal Keywords

`true`, `false`, `nil`, `now`

### Operators

| Operator | Meaning |
|---|---|
| `<-` | Increment by delta (fill) |
| `->` | Decrement by delta (drain) |
| `=` | Reset to value (in func bodies); assignment (in init/const) |
| `==` | Equality comparison (in expressions) |
| `!=` | Inequality |
| `<`, `<=`, `>`, `>=` | Comparison |
| `&&` | Logical AND |
| `\|\|` | Logical OR |
| `!` | Logical NOT |
| `+`, `-`, `*`, `/` | Arithmetic |
| `**` | Exponent |
| `++`, `--` | Postfix increment / decrement (in func bodies only) |
| `\|` | Parallel / nondeterministic step (in run body) |
| `__` | Synthesis placeholder |
