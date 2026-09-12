import { basename } from 'node:path'
import { formatterHelpers, type ITestCaseHookParameter } from '@cucumber/cucumber'
import { after, before, binding, given } from 'specumber'
import { Project } from '../support/project.ts'

@binding([Project])
export default class ProjectSteps {
  private readonly project: Project

  constructor(project: Project) {
    this.project = project
  }

  @before()
  public open({ gherkinDocument, pickle }: ITestCaseHookParameter): void {
    const { line } = formatterHelpers.PickleParser.getPickleLocation({ gherkinDocument, pickle })

    this.project.open(`${basename(pickle.uri)}-${line}`)
  }

  /** A run that failed where the scenario never said it would is the scenario failing. */
  @after()
  public account(): void {
    if (!this.project.ran) return

    const { code, stdout, stderr } = this.project.lastRun

    if (code === 0 || this.project.expectedToFail) return

    throw new Error(`Cucumber exited with ${code}.\n\n${stdout}\n\n${stderr}`)
  }

  @given('a file named {string} with:')
  public file(path: string, content: string): void {
    this.project.write(path, content)
  }

  @given('an empty file named {string}')
  public empty(path: string): void {
    this.project.write(path, '')
  }

  @given('a directory named {string}')
  public directory(path: string): void {
    this.project.mkdir(path)
  }
}
