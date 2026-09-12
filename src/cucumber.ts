// oxlint-disable new-cap -- Cucumber names its registration functions in caps
import {
  After,
  AfterAll,
  AfterStep,
  Before,
  BeforeAll,
  BeforeStep,
  Given,
  Then,
  When,
  type ITestCaseHookParameter,
  type World,
} from '@cucumber/cucumber'
import { parse } from '@cucumber/tag-expressions'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ManagedScenarioContext, type ContextType } from './context.ts'
import { CucumberAttachments, CucumberLog, WorldParameters } from './provided.ts'
import { contextsOf, file, state, type Binding, type Callsite } from './registry.ts'
import { ScenarioInfo } from './scenario.ts'

/** Where the scenario context is kept on the Cucumber world. */
const CONTEXT = Symbol.for('specumber.context')

type Carrier = Record<symbol, ManagedScenarioContext | undefined>

type Method = (...args: unknown[]) => unknown

/**
 * Registers the hooks that give each scenario its context.
 *
 * Every binding class does this as it is declared, so the hooks are in place
 * before any hook of yours. Call it yourself only to reach a context object
 * from a step definition written the Cucumber way, in a support file that
 * declares no binding class of its own.
 */
export function install(): void {
  if (state.installed) return

  state.installed = true

  Before(function (this: World, scenario: ITestCaseHookParameter) {
    const info = new ScenarioInfo(
      scenario.pickle.name,
      scenario.pickle.tags.map(tag => tag.name)
    )

    const context = new ManagedScenarioContext(info, contextsOf)

    context.provide(info)
    context.provide(new WorldParameters(this.parameters))
    context.provide(new CucumberLog(this.log.bind(this)))
    context.provide(new CucumberAttachments(this.attach.bind(this)))

    ;(this as unknown as Carrier)[CONTEXT] = context
  })

  After(function (this: World) {
    ;(this as unknown as Carrier)[CONTEXT]?.dispose()
  })

  ownFramesAreInternal()
}

/** The instance of `type` for the scenario the world belongs to. */
export function getBindingFromWorld<T>(world: World, type: ContextType<T>): T {
  return contextOf(world).get(type)
}

function contextOf(world: World): ManagedScenarioContext {
  const context = (world as unknown as Carrier)[CONTEXT]

  if (context === undefined)
    throw new Error('Scenario context have not been initialized in the provided World object.')

  return context
}

/** Registers one step definition or hook with Cucumber. */
export function register(binding: Binding): void {
  switch (binding.kind) {
    case 'given':
    case 'when':
    case 'then':
      return registerStep(binding)
    case 'before':
      return at(binding, () => Before(hookOptions(binding), scenarioHook(binding)))
    case 'after':
      return at(binding, () => After(hookOptions(binding), scenarioHook(binding)))
    case 'beforeStep':
      return at(binding, () => BeforeStep(hookOptions(binding), scenarioHook(binding)))
    case 'afterStep':
      return at(binding, () => AfterStep(hookOptions(binding), scenarioHook(binding)))
    case 'beforeAll':
      return at(binding, () => BeforeAll(runOptions(binding), runHook(binding)))
    case 'afterAll':
      return at(binding, () => AfterAll(runOptions(binding), runHook(binding)))
  }
}

function registerStep(binding: Binding): void {
  const bindings = file(binding)

  if (bindings === undefined) return

  const pattern = binding.pattern!

  const run = arity(binding, function (this: World, ...args: unknown[]): unknown {
    const context = contextOf(this)
    const selected = select(bindings, pattern, context.scenarioInfo.tags)
    const instance = context.get(selected.target) as Record<string | symbol, Method>

    return instance[selected.key]!.apply(instance, args)
  })

  const options = { timeout: binding.timeout }

  at(binding, () => {
    if (binding.kind === 'given') Given(pattern, options, run)
    else if (binding.kind === 'when') When(pattern, options, run)
    else Then(pattern, options, run)
  })
}

/**
 * Which of the bindings under one step pattern the running scenario is to use.
 *
 * A tagged binding is preferred over an untagged one, so that a binding for
 * `@mobile` overrides the one every other scenario gets. A scenario that
 * matches none of them has no implementation of the step, and says so.
 */
function select(bindings: Binding[], pattern: string | RegExp, tags: string[]): Binding {
  const tagged = bindings.find(binding => binding.tag !== undefined && matches(binding.tag, tags))

  if (tagged !== undefined) return tagged

  const untagged = bindings.find(binding => binding.tag === undefined)

  if (untagged !== undefined) return untagged

  throw new Error(
    `No step definition bound to ${String(pattern)} applies to a scenario tagged ${tags.join(' ')}.`
  )
}

const expressions = new Map<string, { evaluate: (tags: string[]) => boolean }>()

function matches(expression: string, tags: string[]): boolean {
  let parsed = expressions.get(expression)

  if (parsed === undefined) {
    parsed = parse(expression)
    expressions.set(expression, parsed)
  }

  return parsed.evaluate(tags)
}

/** A hook that runs against the binding class instance of the scenario. */
function scenarioHook(binding: Binding): Method {
  return arity(binding, function (this: World, ...args: unknown[]): unknown {
    const instance = contextOf(this).get(binding.target) as Record<string | symbol, Method>

    return instance[binding.key]!.apply(instance, args)
  })
}

/**
 * A hook that runs outside any scenario, and so against no instance: `this` is
 * the class the static method was declared on.
 */
function runHook(binding: Binding): Method {
  const host = binding.host as Record<string | symbol, Method>

  return arity(binding, (...args: unknown[]) => host[binding.key]!.apply(host, args))
}

function hookOptions(binding: Binding): { tags?: string; timeout?: number; name?: string } {
  return { tags: binding.tag, timeout: binding.timeout, name: binding.name }
}

function runOptions(binding: Binding): { timeout?: number; name?: string } {
  return { timeout: binding.timeout, name: binding.name }
}

/**
 * Cucumber reads how many arguments a function takes to decide whether the
 * last one is a callback, so what it is given has to declare as many as the
 * method it calls.
 */
function arity<T extends Method>(binding: Binding, fn: T): T {
  Object.defineProperty(fn, 'length', { value: binding.arity })

  return fn
}

/**
 * Registers with Cucumber as if from the line the decorator was written on.
 *
 * Cucumber locates a step definition by the stack at the moment it is
 * registered, which is inside Specumber, and reports of a run say where a step
 * is defined. This puts the decorator's own line at the top of that stack for
 * as long as the registration takes.
 */
function at(binding: Binding, define: () => void): void {
  const { callsite } = binding

  if (callsite === undefined) return define()

  const prepare = Error.prepareStackTrace

  Error.prepareStackTrace = (error, frames) =>
    [
      `${error}`,
      `    at ${site(callsite)}`,
      ...frames.map(frame => `    at ${String(frame)}`),
    ].join('\n')

  try {
    define()
  } finally {
    Error.prepareStackTrace = prepare
  }
}

function site(callsite: Callsite): string {
  const path = callsite.file.startsWith('file://') ? fileURLToPath(callsite.file) : callsite.file

  return `${path}:${callsite.line}:${callsite.column}`
}

/**
 * Tells Cucumber that Specumber's own frames are not yours.
 *
 * Cucumber cuts a failed step's stack trace at the first frame it recognises
 * as its own; without this, the frames between your step and Cucumber are the
 * ones this module calls it through.
 */
function ownFramesAreInternal(): void {
  const root = dirname(fileURLToPath(import.meta.url))

  try {
    const filter = createRequire(import.meta.url)('@cucumber/cucumber/lib/filter_stack_trace') as {
      isFileNameInCucumber?: (fileName: string) => boolean
    }

    const isInCucumber = filter.isFileNameInCucumber

    if (typeof isInCucumber !== 'function') return

    Object.defineProperty(filter, 'isFileNameInCucumber', {
      value: (fileName: string) => isInCucumber(fileName) || fileName.startsWith(root),
      configurable: true,
      enumerable: true,
    })
  } catch {
    // Reaching inside Cucumber is not something it promises to keep working.
    // Stack traces are then longer than they need to be, and nothing else.
  }
}
