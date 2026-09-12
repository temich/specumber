import type { World } from '@cucumber/cucumber'
import type { ContextType } from './context.ts'
import { ScenarioInfo } from './scenario.ts'

/** Cucumber's `world.attach`, with every overload it offers. */
type Attach = World['attach']

/** Cucumber's `world.log`. */
type Log = World['log']

/**
 * The `worldParameters` of the configuration, or the `--world-parameters` of
 * the command line.
 *
 * Request it as a context type to have it injected.
 */
export class WorldParameters<T = unknown> {
  public readonly value: T

  constructor(value: T) {
    this.value = value
  }
}

/**
 * Cucumber's `world.log`: text attached to the running step, which the
 * formatters print.
 *
 * Request it as a context type to have it injected.
 */
export class CucumberLog {
  private readonly target: Log

  constructor(log: Log) {
    this.target = log
  }

  public log(text: string): void {
    this.target(text)
  }
}

/**
 * Cucumber's `world.attach`: data attached to the running step, which the
 * formatters carry into the report.
 *
 * Request it as a context type to have it injected.
 */
export class CucumberAttachments {
  public readonly attach: Attach

  constructor(attach: Attach) {
    this.attach = attach
  }
}

/**
 * The types Pupumber constructs itself, from the Cucumber world, when a
 * scenario starts. Asking for one outside a scenario is an error rather than
 * an instance built from nothing.
 */
export const PROVIDED = new Set<ContextType>([
  ScenarioInfo,
  WorldParameters,
  CucumberLog,
  CucumberAttachments,
])
