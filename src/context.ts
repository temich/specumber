import { PROVIDED } from './provided.ts'
import type { ScenarioInfo } from './scenario.ts'

/**
 * A class Specumber may construct on its own: a binding class or a context.
 *
 * `never` for the arguments is what makes every class assignable, whatever its
 * constructor takes; the arguments are supplied from `contexts` below.
 */
export type ContextType<T = unknown> = new (...args: never[]) => T

/** The state of one running scenario. */
export interface ScenarioContext {
  scenarioInfo: ScenarioInfo
}

/**
 * The context objects of one scenario, and how they come to be.
 *
 * A type is constructed at most once per scenario, the first time something
 * asks for it, and every asker then gets that same instance — which is what
 * makes a context object a way to share state between binding classes. The
 * instances are dropped when the scenario ends.
 */
export class ManagedScenarioContext {
  public readonly scenarioInfo: ScenarioInfo

  private readonly instances = new Map<ContextType, unknown>()

  /** How each type asks for the types it is constructed from. */
  private readonly dependencies: (type: ContextType) => ContextType[]

  constructor(scenarioInfo: ScenarioInfo, dependencies: (type: ContextType) => ContextType[]) {
    this.scenarioInfo = scenarioInfo
    this.dependencies = dependencies
  }

  /** The instance of `type` for this scenario, constructing it if needed. */
  public get<T>(type: ContextType<T>): T {
    if (this.instances.has(type)) return this.instances.get(type) as T

    if (PROVIDED.has(type))
      throw new Error(`${type.name} is only available while a scenario is running.`)

    const contexts = this.dependencies(type).map(dependency => this.get(dependency))

    // oxlint-disable-next-line new-cap -- a class held in a variable
    const instance = new (type as new (...args: unknown[]) => T)(...contexts)

    this.instances.set(type, instance)

    return instance
  }

  /** Takes an instance Specumber has made itself, in place of constructing one. */
  public provide(instance: object): void {
    const type = instance.constructor as ContextType

    if (this.instances.has(type)) throw new Error(`Conflicting instances of ${type.name} provided.`)

    this.instances.set(type, instance)
  }

  /** Calls `dispose` on every context object that has one. */
  public dispose(): void {
    for (const instance of this.instances.values()) {
      const { dispose } = instance as { dispose?: unknown }

      if (typeof dispose === 'function') dispose.call(instance)
    }

    this.instances.clear()
  }
}
