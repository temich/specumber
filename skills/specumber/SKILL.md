---
name: specumber
description: Write and review Cucumber scenarios and the specumber bindings behind them — Gherkin that explains the behaviour it proves, and the TypeScript classes that run it. Use when adding or changing .feature files, step definitions, binding classes or context objects in a project that depends on specumber.
---

# Scenarios with specumber

## What a scenario is for

A scenario has two readers. One needs to know what the system does and has not opened the source.
The other is the run that proves the system still does it. A scenario that satisfies only the
second is half written: it passes, and it says nothing.

So a feature file is read as documentation first. Someone who needs to call the thing should be
able to read it and know what to send, what comes back, and what happens when it goes wrong —
without the implementation open beside them. What no scenario states is not part of the contract,
and nothing else says it is.

This is also the order to work in: write the scenario, watch it fail for the reason you expect,
then write the code, then watch it pass. A scenario that has never failed has not been shown to
test anything.

## Writing the scenario

**Name the requirement, not the mechanism.** `Scenario: A message is rejected without a sender`
tells a reader what holds. `Scenario: POST /messages returns 400` tells them what the code does
today.

**One `When`.** `Given` is the state the world is in, `When` is the single thing that happens,
`Then` is what someone can observe afterwards. Two `When`s in a scenario are two scenarios, or a
`Given` doing the work of setup.

**Write what is required, not what is incidental.** If the order of a list is not part of the
contract, do not assert it — a scenario that pins it makes every unrelated change a failure, and
tells the reader something untrue. Before asserting a value, ask who breaks if it changes.

**Say what happens when it fails.** The error cases are the half of the contract most often left
out, and the half a caller most needs. A feature with only its happy path documents an interface
nobody can use safely.

**Use the language of the domain.** A scenario is written in the words the people who need the
behaviour use, not in the words of the code that implements it. Where the two differ, the
scenario is the one to keep.

**Keep the steps at one altitude.** `Given the customer has an active subscription` and
`Given a row in the subscriptions table with status 2` do not belong in the same scenario. The
second is the first with the answer spoiled.

**Data tables and doc strings are part of the sentence.** Use them when the shape of the data is
what the reader needs to see, not to compress three scenarios into one.

## Binding the steps

A class decorated with `@binding()` is instantiated once per scenario, so instance fields are how
one step passes state to the next:

```ts
import assert from 'node:assert/strict'
import { binding, given, then, when } from 'specumber'

@binding()
export default class Basket {
  private items: string[] = []
  private total = 0

  @given('a basket with {word}')
  public start(item: string): void {
    this.items = [item]
  }

  @when('the basket is priced')
  public price(): void {
    this.total = this.items.length * 100
  }

  @then('the total is {int}')
  public check(expected: number): void {
    assert.equal(this.total, expected)
  }
}
```

The decorators take the pattern the step matches — a Cucumber expression or a regular expression
— and the captured arguments become the arguments of the method. Which keyword a step is bound
with does not narrow what it matches: as in Cucumber itself, `Given`, `When` and `Then` in a
feature file all match on the text of the step alone.

Options come after the pattern:

```ts
@given('the database is seeded', { timeout: 60_000 })
@given('the platform is prepared', { tag: '@mobile' })
```

`timeout` is milliseconds. `tag` is a Cucumber tag expression: two classes may bind the same
pattern if each says which scenarios it is for, and the tagged binding wins over the untagged one.

## Hooks

| Decorator                   | Runs                             |
| --------------------------- | -------------------------------- |
| `@before`, `@after`         | Around each scenario             |
| `@beforeStep`, `@afterStep` | Around each step                 |
| `@beforeAll`, `@afterAll`   | Once per run, on a static method |

They take `{ tag, timeout, name }`; `@beforeAll` and `@afterAll` run outside any scenario, so they
see neither the instance nor its context objects.

A hook is for what the reader does not need to be told — a temporary directory, a connection. What
the scenario is about belongs in a `Given`, where it can be read.

## Sharing state between classes

A class listed in `@binding([...])` is constructed and passed to the constructor. One instance is
made per scenario however many classes ask for it, which is what lets two step classes share
state:

```ts
export class Workspace {
  public folder = 'default folder'
}

@binding([Workspace])
export default class FileSteps {
  private readonly workspace: Workspace

  constructor(workspace: Workspace) {
    this.workspace = workspace
  }

  @given('the folder is {string}')
  public folder(name: string): void {
    this.workspace.folder = name
  }
}
```

A context class may itself be a `@binding([...])` and ask for others, to any depth. If it has a
`dispose` method, it is called when the scenario ends.

Four contexts come from Cucumber rather than from you: `ScenarioInfo` (the title and tags of the
running scenario), `WorldParameters`, `CucumberLog` and `CucumberAttachments`.

## Running

Something has to compile the support files before Cucumber imports them — Node strips types but
does not run decorators:

```sh
NODE_OPTIONS=--import=tsx cucumber-js
```

Nothing is needed in `tsconfig.json`: specumber reads a decorator under either proposal, the
standard one and `experimentalDecorators`.

## Before calling it done

- Read the feature file as if you did not write the code. Does it say what the thing does?
- Does every assertion state something someone would complain about if it changed?
- Is the failure path there?
- Did the scenario fail before the code was written, and for the reason you expected?
