import { findSourceMap } from 'node:module'
import type { ContextType } from './context.ts'
import {
  claim,
  contextsOf,
  declare,
  setContexts,
  type BindingKind,
  type Callsite,
  type Declaration,
  type Host,
  type StepPattern,
} from './registry.ts'
import { install, register } from './cucumber.ts'

/**
 * A class decorator, written to be applied under either decorator proposal:
 * the legacy one Cucumber support code has always used
 * (`experimentalDecorators`), and the standard one of TypeScript 5 and later.
 */
export interface ClassBinder {
  <T extends ContextType>(target: T): T
  <T extends ContextType>(target: T, context: ClassDecoratorContext): T
}

/** A method decorator, applicable under either decorator proposal. */
export interface MemberBinder {
  (host: object, key: string | symbol, descriptor: PropertyDescriptor): void
  (method: unknown, context: DecoratorContext): void
}

/** What a step definition may be given besides its pattern. */
export interface StepOptions {
  /** A Cucumber tag expression this step is limited to. */
  tag?: string
  /** Milliseconds the step may run for. */
  timeout?: number
}

/** What a hook may be given. */
export interface HookOptions {
  /** A Cucumber tag expression this hook is limited to. */
  tag?: string
  /** As `tag`. */
  tags?: string
  /** Milliseconds the hook may run for. */
  timeout?: number
  /** The name the hook is reported under. */
  name?: string
}

/**
 * Marks a class as a binding: the steps and hooks declared on it are
 * registered with Cucumber, and an instance of it is created for each scenario
 * that runs one of them.
 *
 * @param contexts The types to construct and pass to the constructor. See
 * "Sharing state" in the README.
 */
export function binding(contexts?: ContextType[]): ClassBinder {
  const binder = <T extends ContextType>(target: T): T => {
    install()

    setContexts(target, contexts ?? [])
    ensureAcyclic(target)

    for (const claimed of claim(target)) register(claimed)

    return target
  }

  return binder as ClassBinder
}

/**
 * A `Given` step definition.
 *
 * @param pattern A Cucumber expression, or a regular expression.
 * @param tagOrOptions A tag expression, or the options.
 * @param timeout Milliseconds, when a tag expression was given.
 */
export function given(
  pattern: StepPattern,
  tagOrOptions?: string | StepOptions,
  timeout?: number
): MemberBinder {
  return member('given', pattern, stepOptions(tagOrOptions, timeout))
}

/**
 * A `When` step definition.
 *
 * @param pattern A Cucumber expression, or a regular expression.
 * @param tagOrOptions A tag expression, or the options.
 * @param timeout Milliseconds, when a tag expression was given.
 */
export function when(
  pattern: StepPattern,
  tagOrOptions?: string | StepOptions,
  timeout?: number
): MemberBinder {
  return member('when', pattern, stepOptions(tagOrOptions, timeout))
}

/**
 * A `Then` step definition.
 *
 * @param pattern A Cucumber expression, or a regular expression.
 * @param tagOrOptions A tag expression, or the options.
 * @param timeout Milliseconds, when a tag expression was given.
 */
// oxlint-disable-next-line unicorn/no-thenable -- the name Cucumber gives this step
export function then(
  pattern: StepPattern,
  tagOrOptions?: string | StepOptions,
  timeout?: number
): MemberBinder {
  return member('then', pattern, stepOptions(tagOrOptions, timeout))
}

/** A hook that runs before each scenario. */
export function before(tagOrOptions?: string | HookOptions): MemberBinder {
  return member('before', undefined, hookOptions(tagOrOptions))
}

/** A hook that runs after each scenario. */
export function after(tagOrOptions?: string | HookOptions): MemberBinder {
  return member('after', undefined, hookOptions(tagOrOptions))
}

/** A hook that runs once before the first scenario. Decorates a static method. */
export function beforeAll(options?: HookOptions): MemberBinder {
  return member('beforeAll', undefined, hookOptions(options))
}

/** A hook that runs once after the last scenario. Decorates a static method. */
export function afterAll(options?: HookOptions): MemberBinder {
  return member('afterAll', undefined, hookOptions(options))
}

/** A hook that runs before each step. */
export function beforeStep(tagOrOptions?: string | HookOptions): MemberBinder {
  return member('beforeStep', undefined, hookOptions(tagOrOptions))
}

/** A hook that runs after each step. */
export function afterStep(tagOrOptions?: string | HookOptions): MemberBinder {
  return member('afterStep', undefined, hookOptions(tagOrOptions))
}

type Options = Pick<Declaration, 'tag' | 'timeout' | 'name'>

function stepOptions(tagOrOptions?: string | StepOptions, timeout?: number): Options {
  if (tagOrOptions === undefined || typeof tagOrOptions === 'string')
    return { tag: tag(tagOrOptions), timeout }

  if (timeout !== undefined)
    throw new Error('Cannot specify a separate timeout argument when an options object is given.')

  return { tag: tag(tagOrOptions.tag), timeout: tagOrOptions.timeout }
}

function hookOptions(tagOrOptions?: string | HookOptions): Options {
  if (tagOrOptions === undefined || typeof tagOrOptions === 'string')
    return { tag: tag(tagOrOptions) }

  return {
    tag: tag(tagOrOptions.tag ?? tagOrOptions.tags),
    timeout: tagOrOptions.timeout,
    name: tagOrOptions.name,
  }
}

/** A tag expression of one word is the tag of that name. */
function tag(expression?: string): string | undefined {
  if (expression === undefined || expression.includes('@')) return expression

  return `@${expression}`
}

function member(
  kind: BindingKind,
  pattern: StepPattern | undefined,
  options: Options
): MemberBinder {
  const callsite = here()

  const binder = (...args: unknown[]): void => {
    declare({ ...options, ...applied(args), kind, pattern, callsite })
  }

  return binder as MemberBinder
}

type Applied = Pick<Declaration, 'key' | 'method' | 'arity' | 'host' | 'isStatic'>

/**
 * What the two decorator proposals say, read as one.
 *
 * A legacy decorator is called with the prototype (or the class, for a static
 * member), the name, and the property descriptor. A standard decorator is
 * called with the method and a context object naming it.
 */
function applied(args: unknown[]): Applied {
  const [first, second, third] = args

  if (isContext(second)) {
    const method = first as Declaration['method']

    return {
      key: second.name as string | symbol,
      method,
      arity: method.length,
      isStatic: second.static === true,
    }
  }

  const host = first as Host
  const key = second as string | symbol
  const descriptor = third as PropertyDescriptor | undefined
  const method = (descriptor?.value ??
    (host as Record<string | symbol, unknown>)[key]) as Declaration['method']

  return { host, key, method, arity: method.length, isStatic: typeof host === 'function' }
}

function isContext(value: unknown): value is DecoratorContext & { static?: boolean } {
  return typeof value === 'object' && value !== null && 'kind' in value && 'name' in value
}

/**
 * Where the decorator below this call was written, which is where Cucumber is
 * told the step or hook is defined.
 *
 * The first frame outside this module is the one that wrote the decorator: the
 * decorator factories all live here.
 */
function here(): Callsite | undefined {
  const prepare = Error.prepareStackTrace

  try {
    Error.prepareStackTrace = (_, frames) => frames

    const frames = new Error().stack as unknown as NodeJS.CallSite[]
    const inside = frames[0]?.getFileName()
    const frame = frames.find(candidate => candidate.getFileName() !== inside)

    if (frame === undefined) return undefined

    const file = frame.getFileName()
    const line = frame.getLineNumber()

    if (typeof file !== 'string' || typeof line !== 'number') return undefined

    return original(file, line, frame.getColumnNumber() ?? 1)
  } catch {
    return undefined
  } finally {
    Error.prepareStackTrace = prepare
  }
}

/**
 * Where a frame was before the file was compiled.
 *
 * Support code reaches Node through a loader that turns TypeScript into
 * JavaScript, and the line a frame reports is the line of that output. Every
 * such loader leaves a source map behind saying what the line was.
 */
function original(file: string, line: number, column: number): Callsite {
  const entry = findSourceMap(file)?.findEntry(line - 1, column - 1)

  if (entry === undefined || !('originalSource' in entry)) return { file, line, column }

  return {
    file: entry.originalSource,
    line: entry.originalLine + 1,
    column: entry.originalColumn + 1,
  }
}

/**
 * Refuses a context type that is constructed from itself, directly or through
 * others, which would otherwise recurse until the stack ends.
 *
 * A context type that is undefined where the class is declared is refused
 * here too, rather than at the moment a scenario tries to construct it.
 */
function ensureAcyclic(target: ContextType, path: ContextType[] = []): void {
  for (const dependency of contextsOf(target)) {
    if (path.includes(dependency))
      throw new Error(
        `Cyclic dependency detected: ${dependency.name} -> ${target.name} -> ${path
          .map(type => type.name)
          .join(' -> ')}`
      )

    ensureAcyclic(dependency, [...path, target])
  }
}
