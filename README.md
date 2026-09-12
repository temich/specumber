# Specumber

SpecFlow-style bindings for [Cucumber](https://github.com/cucumber/cucumber-js): step
definitions and hooks are methods of a class, and the class is what holds the state of a
scenario.

> Specumber is inspired by the excellent work of [Tim Roberts](https://github.com/timjroberts) and the contributors to [cucumber-js-tsflow](https://github.com/timjroberts/cucumber-js-tsflow).  
> It is intended as a modern drop-in replacement and passes the original project's test suite.

```ts
import { binding, given, then, when } from 'specumber'

@binding()
export default class Arithmetic {
  private result = 0

  @given('I enter {int} and {int}')
  public enter(one: number, other: number): void {
    this.result = one + other
  }

  @then('I receive the result {int}')
  public receive(expected: number): void {
    assert.equal(this.result, expected)
  }
}
```

A fresh instance is created for each scenario, so one scenario never sees what another left
behind. State that several classes share is a class of its own — see [Sharing state](#sharing-state).

## Install

```sh
npm install -D @cucumber/cucumber specumber
```

Specumber needs Node 24 or later and `@cucumber/cucumber` 13.

Something has to compile the support files before Cucumber imports them. Node will not do it on
its own: it strips types, but a decorator is not a type, and `node steps.ts` stops at the `@`
with a `SyntaxError` — `--experimental-transform-types` included. Either a loader compiles them
as they are imported:

```sh
NODE_OPTIONS=--import=tsx cucumber-js
node --import tsx ./node_modules/.bin/cucumber-js   # the same thing without the variable
```

or `tsc` compiles them first, and Cucumber is pointed at the output, which needs no loader at
all. A `target` of `esnext` leaves standard decorators in the output for the runtime to run, and
Node has nowhere to run them, so compile to `es2022` or below.

Cucumber's own `--loader` will not do: it registers a module through `module.register`, and
`tsx` refuses to be loaded that way.

Nothing has to change in your `tsconfig.json`. Specumber's decorators are written to be applied
under both decorator proposals — the standard one of TypeScript 5 and later, and the older
`experimentalDecorators` — so a project keeps whichever it already uses.

## Quick start

A feature:

```gherkin
# features/arithmetic.feature

Feature: Arithmetic
  Scenario: Adding two numbers
    Given I enter 2 and 8
    Then I receive the result 10
```

The class that implements it, saved where Cucumber looks for support code:

```ts
// features/steps/arithmetic.ts

import assert from 'node:assert/strict'
import { binding, given, then } from 'specumber'

@binding()
export default class Arithmetic {
  private result = 0

  @given('I enter {int} and {int}')
  public enter(one: number, other: number): void {
    this.result = one + other
  }

  @then('I receive the result {int}')
  public receive(expected: number): void {
    assert.equal(this.result, expected)
  }
}
```

And the run:

```sh
NODE_OPTIONS=--import=tsx cucumber-js
```

## Bindings

`@binding()` marks a class as one Cucumber is to know about. The steps and hooks declared on it
are registered the moment the class is declared, which is when Cucumber imports the file.

A method decorated in a class that carries no `@binding()` is registered with nothing, and never
runs.

## Step definitions

`@given`, `@when` and `@then` take the pattern the step matches: a
[Cucumber expression](https://github.com/cucumber/cucumber-expressions) or a regular expression.
The arguments the pattern captures are the arguments of the method.

```ts
@binding()
export default class Search {
  @given(/^I search for "([^"]*)"$/)
  public search(term: string): void {}

  @when('I open result {int}')
  public open(index: number): void {}
}
```

Which keyword a step definition is declared with does not narrow what it matches: as in Cucumber
itself, `Given`, `When` and `Then` in a feature file all match on the text of the step alone.

A step may be given options. A tag expression is Cucumber's
[own](https://cucumber.io/docs/cucumber/api/#tag-expressions).

```ts
@given('the database is seeded', { timeout: 60_000 })
public seed(): Promise<void> {}
```

| Option    |                                                                             |
| --------- | --------------------------------------------------------------------------- |
| `timeout` | Milliseconds the step may run for.                                          |
| `tag`     | A tag expression the step is limited to. See [Tagged steps](#tagged-steps). |

A single word is read as a tag of that name, so `{ tag: 'mobile' }` and `{ tag: '@mobile' }` mean
the same thing.

## Hooks

| Decorator     | Runs                                                        |
| ------------- | ----------------------------------------------------------- |
| `@before`     | Before each scenario.                                       |
| `@after`      | After each scenario.                                        |
| `@beforeStep` | Before each step.                                           |
| `@afterStep`  | After each step.                                            |
| `@beforeAll`  | Once, before the first scenario. Decorates a static method. |
| `@afterAll`   | Once, after the last scenario. Decorates a static method.   |

```ts
@binding([Workspace])
export default class Steps {
  private readonly workspace: Workspace

  constructor(workspace: Workspace) {
    this.workspace = workspace
  }

  @beforeAll()
  public static start(): void {}

  @before({ tag: '@slow', timeout: 30_000, name: 'clear the workspace' })
  public clear(): Promise<void> {
    return this.workspace.clear()
  }
}
```

| Option    |                                                                                      |
| --------- | ------------------------------------------------------------------------------------ |
| `timeout` | Milliseconds the hook may run for.                                                   |
| `tag`     | A tag expression the hook is limited to. Not on the two that run outside a scenario. |
| `name`    | The name the hook is reported under.                                                 |

`@beforeAll` and `@afterAll` run where no scenario exists, and so against no instance: they
decorate static methods, and can reach neither the scenario's state nor its context objects.

Hooks of the same kind run in the order they are declared, and `@after` hooks in reverse, which
is Cucumber's own order.

## Sharing state

A class listed in `@binding([...])` is constructed and passed to the constructor. One instance is
made per scenario, however many classes ask for it, which is what lets two binding classes share
state:

```ts
// features/support/workspace.ts

export class Workspace {
  public folder = 'default folder'
}
```

```ts
// features/steps/files.ts

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

A context class is constructed with no arguments unless it is itself a `@binding([...])`, in which
case it is constructed with the contexts it asks for, to any depth. A cycle between them is
refused where the class is declared, rather than when a scenario runs into it.

If a context object has a `dispose` method, it is called when the scenario ends.

## Provided contexts

Four context types come from Cucumber rather than from you, and are asked for the same way.

| Type                  |                                                                                  |
| --------------------- | -------------------------------------------------------------------------------- |
| `ScenarioInfo`        | The title and tags of the running scenario.                                      |
| `WorldParameters`     | `worldParameters` of the configuration, or `--world-parameters`, under `.value`. |
| `CucumberLog`         | `log(text)`, which attaches text to the running step.                            |
| `CucumberAttachments` | `attach(data, mediaType)`, which attaches data to the running step.              |

```ts
@binding([ScenarioInfo, CucumberLog])
export default class Steps {
  private readonly scenario: ScenarioInfo
  private readonly log: CucumberLog

  constructor(scenario: ScenarioInfo, log: CucumberLog) {
    this.scenario = scenario
    this.log = log
  }

  @before()
  public report(): void {
    this.log.log(`running ${this.scenario.scenarioTitle}`)
  }
}
```

### Reading tags

Cucumber gives a scenario the tags of its feature as well as its own, with nothing to tell the two
apart. `ScenarioInfo` reads them in three shapes:

| Tag                       | Read by                        | Answer                           |
| ------------------------- | ------------------------------ | -------------------------------- |
| `@slow`                   | `getFlag('slow')`              | `true`                           |
| `@browser(firefox)`       | `getOptionTag('browser')`      | `'firefox'`                      |
| `@browser(firefox)` twice | `getMultiOptionTag('browser')` | `['firefox', ...]`               |
| `@window({"width":800})`  | `getAttributeTag('window')`    | `{ width: 800 }`, parsed as JSON |

Where a tag is written twice, `getOptionTag` and `getAttributeTag` answer with the last of them,
which is the scenario's own when the feature carries one too. `getAttributeTag` answers
`undefined` for a value that is not JSON.

## Tagged steps

Two classes may bind the same step pattern if they are told which scenarios they are for:

```ts
@binding()
class Desktop {
  @given('the platform is prepared')
  public prepare(): void {}
}

@binding()
class Mobile {
  @given('the platform is prepared', '@mobile')
  public prepare(): void {}
}
```

A scenario tagged `@mobile` runs the second; every other scenario runs the first. A tagged binding
is preferred over an untagged one. A scenario that matches none of the bindings under a pattern has
no implementation of that step, and the step fails saying so.

Cucumber itself is told of the pattern once — a second registration of the same pattern is what it
calls an ambiguous step definition.

## Cucumber's own step definitions

Step definitions written the Cucumber way can reach the same context objects, through the world:

```ts
import { Before, Given } from '@cucumber/cucumber'
import { ensureWorldIsInitialized, getBindingFromWorld } from 'specumber'

ensureWorldIsInitialized()

Given('the folder is cleared', function () {
  getBindingFromWorld(this, Workspace).folder = ''
})
```

`ensureWorldIsInitialized` is needed only in a support file that declares no binding class of its
own: every `@binding()` does the same thing as it is declared.

## Coming from cucumber-tsflow

The interface is the one
[cucumber-tsflow](https://github.com/timjroberts/cucumber-js-tsflow) documents, and the same
import of the same names works. What differs:

- Specumber is an ES module, and the support files that use it are ES modules: `export = Steps`
  becomes `export default Steps`.
- `wrapperOptions` is gone, along with the `setDefinitionFunctionWrapper` that Cucumber deprecated.
- A tag on a step definition decides which binding runs, rather than being carried and ignored.
- A step is reported as defined where its decorator is written, rather than inside the library.

## Requirements

|                      |                                               |
| -------------------- | --------------------------------------------- |
| Node                 | 24 or later                                   |
| `@cucumber/cucumber` | 13                                            |
| TypeScript           | 5 or later, with either decorator proposal    |
| Dependencies         | `@cucumber/tag-expressions`, and nothing else |

## License

[MIT](LICENSE)

## Authors

> This project is created and maintained by robots.
