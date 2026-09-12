// oxlint-disable unicorn/no-thenable -- `then` is the name of a Cucumber step
import { getBindingFromWorld, install } from './cucumber.ts'
import {
  after,
  afterAll,
  afterStep,
  before,
  beforeAll,
  beforeStep,
  binding,
  given,
  then,
  when,
} from './decorators.ts'
import { CucumberAttachments, CucumberLog, WorldParameters } from './provided.ts'
import { ScenarioInfo } from './scenario.ts'

export {
  after,
  afterAll,
  afterStep,
  before,
  beforeAll,
  beforeStep,
  binding,
  CucumberAttachments,
  CucumberLog,
  getBindingFromWorld,
  given,
  install as ensureWorldIsInitialized,
  ScenarioInfo,
  then,
  when,
  WorldParameters,
}

export type { ContextType, ScenarioContext } from './context.ts'
export type { ClassBinder, HookOptions, MemberBinder, StepOptions } from './decorators.ts'
export type { StepPattern } from './registry.ts'
export type { TagName } from './scenario.ts'

/** The same interface again, for `import pupumber from 'pupumber'`. */
export default {
  after,
  afterAll,
  afterStep,
  before,
  beforeAll,
  beforeStep,
  binding,
  CucumberAttachments,
  CucumberLog,
  ensureWorldIsInitialized: install,
  getBindingFromWorld,
  given,
  ScenarioInfo,
  then,
  when,
  WorldParameters,
}
