/**
 * Every part of the interface, written the way a project would write it.
 *
 * Type-checked twice, once with `experimentalDecorators` and once without, to
 * hold the promise that neither needs anything of the project's own tsconfig.
 */
// oxlint-disable new-cap -- Cucumber names its registration functions in caps
import { Given, type World } from '@cucumber/cucumber'
import {
  after,
  afterAll,
  afterStep,
  before,
  beforeAll,
  beforeStep,
  binding,
  CucumberAttachments,
  CucumberLog,
  ensureWorldIsInitialized,
  getBindingFromWorld,
  given,
  ScenarioInfo,
  then,
  when,
  WorldParameters,
} from 'pupumber'

ensureWorldIsInitialized()

export class Workspace {
  public folder = 'default folder'
}

@binding([Workspace])
export class Steps {
  private readonly workspace: Workspace

  constructor(workspace: Workspace) {
    this.workspace = workspace
  }

  @beforeAll()
  public static start(): void {}

  @afterAll({ timeout: 1000 })
  public static stop(): void {}

  @before()
  public prepare(): void {}

  @after('@slow')
  public clean(): void {}

  @before({ name: 'set the folder up', tag: '@slow', timeout: 1000 })
  public named(): void {}

  @beforeStep()
  public step(): void {}

  @afterStep({ tag: '@slow' })
  public stepped(): void {}

  @given('a folder named {string}')
  public folder(name: string): void {
    this.workspace.folder = name
  }

  @when(/^the folder is emptied$/, '@slow', 2000)
  public empty(): void {}

  @then('the folder is {string}', { timeout: 1000 })
  public check(name: string): void {
    if (this.workspace.folder !== name) throw new Error('not the folder')
  }
}

@binding([ScenarioInfo, WorldParameters, CucumberLog, CucumberAttachments])
export class Provided {
  private readonly scenario: ScenarioInfo
  private readonly parameters: WorldParameters<{ host: string }>
  private readonly log: CucumberLog
  private readonly attachments: CucumberAttachments

  constructor(
    scenario: ScenarioInfo,
    parameters: WorldParameters<{ host: string }>,
    log: CucumberLog,
    attachments: CucumberAttachments
  ) {
    this.scenario = scenario
    this.parameters = parameters
    this.log = log
    this.attachments = attachments
  }

  @then('the scenario is reported')
  public report(): void {
    const flag: boolean = this.scenario.getFlag('slow')
    const browser: string | undefined = this.scenario.getOptionTag('browser')
    const browsers: string[] = this.scenario.getMultiOptionTag('browser')
    const window: unknown = this.scenario.getAttributeTag('window')

    this.log.log(`${this.scenario.scenarioTitle} on ${this.parameters.value.host}`)
    this.log.log(`${this.scenario.tags.join(' ')} ${flag} ${browser} ${browsers.length} ${window}`)
    this.attachments.attach('a note', 'text/plain')
  }
}

Given('a folder', function (this: World) {
  const workspace: Workspace = getBindingFromWorld(this, Workspace)

  workspace.folder = 'set the Cucumber way'
})
