import type { ContextType } from './context.ts'

/** A Cucumber step pattern: a Cucumber expression, or a regular expression. */
export type StepPattern = string | RegExp

export type StepKind = 'given' | 'when' | 'then'

export type HookKind = 'before' | 'after' | 'beforeAll' | 'afterAll' | 'beforeStep' | 'afterStep'

export type BindingKind = StepKind | HookKind

/** Where a decorated method lives: a prototype, or the class itself if static. */
export type Host = object

/** The source line a decorator was written on. */
export interface Callsite {
  file: string
  line: number
  column: number
}

export interface BindingOptions {
  /** A Cucumber tag expression the binding is limited to. */
  tag?: string
  /** Milliseconds the binding may run for. */
  timeout?: number
  /** The name a hook is reported under. */
  name?: string
}

/** A decorated method, before the class decorator has claimed it. */
export interface Declaration extends BindingOptions {
  kind: BindingKind
  pattern?: StepPattern
  key: string | symbol
  /** The method itself, which is what identifies the class it belongs to. */
  method: (...args: any[]) => unknown
  /** How many arguments the method takes, which is what Cucumber calls it with. */
  arity: number
  /** Known to a legacy decorator, which is given it; unknown to a standard one. */
  host?: Host
  isStatic: boolean
  callsite?: Callsite
}

/** A declaration a binding class has claimed. */
export interface Binding extends Declaration {
  target: ContextType
  host: Host
}

interface Target {
  bindings: Binding[]
  contexts: ContextType[]
}

interface State {
  /** What each binding class was declared with. */
  targets: Map<ContextType, Target>
  /** Declarations no class decorator has claimed yet. */
  pending: Declaration[]
  /** Every binding under a step pattern, in the order the classes were declared. */
  steps: Map<string, Binding[]>
  /** Whether the hooks that set a scenario up have been registered. */
  installed: boolean
}

/**
 * Two copies of Pupumber can be loaded at once, one imported and one required,
 * and each would register the scenario hooks again and keep a registry the
 * other cannot see. They share this one instead.
 */
const SLOT = Symbol.for('pupumber.state')

const store = globalThis as unknown as Record<symbol, State | undefined>

store[SLOT] ??= { targets: new Map(), pending: [], steps: new Map(), installed: false }

export const state: State = store[SLOT]!

/** Records a decorated method, for the class decorator below it to claim. */
export function declare(declaration: Declaration): void {
  state.pending.push(declaration)
}

/**
 * Hands a binding class every declaration made on it.
 *
 * A legacy decorator is given the prototype the method was declared on, so
 * matching is exact. A standard decorator is given neither the class nor its
 * prototype, as the class does not exist yet when its members are decorated,
 * so the method itself is matched instead, which also finds one inherited
 * from a base class.
 *
 * Declarations that match nothing stay pending: they belong to a class that
 * has not been decorated yet, or to one that never will be.
 */
export function claim(target: ContextType): Binding[] {
  const claimed: Binding[] = []
  const pending: Declaration[] = []

  for (const declaration of state.pending) {
    const host = hostOf(declaration, target)

    if (host === undefined) pending.push(declaration)
    else claimed.push({ ...declaration, target, host })
  }

  state.pending = pending

  const registered = state.targets.get(target)

  if (registered === undefined) state.targets.set(target, { bindings: claimed, contexts: [] })
  else registered.bindings.push(...claimed)

  return claimed
}

function hostOf(declaration: Declaration, target: ContextType): Host | undefined {
  const host = declaration.isStatic ? target : (target.prototype as Host)

  if (declaration.host !== undefined) return declaration.host === host ? host : undefined

  return (host as Record<string | symbol, unknown>)[declaration.key] === declaration.method
    ? host
    : undefined
}

/** The types a binding class is constructed from. */
export function contextsOf(target: ContextType): ContextType[] {
  return state.targets.get(target)?.contexts ?? []
}

export function setContexts(target: ContextType, contexts: ContextType[]): void {
  const registered = state.targets.get(target)

  if (registered === undefined) state.targets.set(target, { bindings: [], contexts })
  else registered.contexts = contexts
}

/**
 * Files a step binding under its pattern.
 *
 * One pattern is registered with Cucumber once, however many classes bind it:
 * Cucumber would call a second registration of the same pattern ambiguous.
 * The bindings filed under it are what the registration then chooses between,
 * which is how a tagged step definition comes to exist at all.
 *
 * Answers the bindings under the pattern when this is the first one there, and
 * `undefined` otherwise.
 */
export function file(binding: Binding): Binding[] | undefined {
  const key = `${binding.kind} ${String(binding.pattern)}`

  const filed = state.steps.get(key)

  if (filed === undefined) {
    const bindings = [binding]

    state.steps.set(key, bindings)

    return bindings
  }

  filed.push(binding)

  return undefined
}
