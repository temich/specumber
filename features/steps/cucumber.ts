import assert from 'node:assert/strict'
import { binding, then, when } from 'specumber'
import { contains, occurrences } from '../support/output.ts'
import { Project } from '../support/project.ts'

@binding([Project])
export default class CucumberSteps {
  private readonly project: Project

  constructor(project: Project) {
    this.project = project
  }

  @when('I run cucumber-js')
  public async run(): Promise<void> {
    await this.project.cucumber()
  }

  @when('I run cucumber-js with env `{}`')
  public async runWith(env: string): Promise<void> {
    await this.project.cucumber(Object.fromEntries([env.split('=')]))
  }

  @then('it passes')
  public passes(): void {
    const { code, stdout, stderr } = this.project.lastRun

    assert.equal(code, 0, `Cucumber exited with ${code}.\n\n${stdout}\n\n${stderr}`)
  }

  @then('it fails')
  public fails(): void {
    const { code } = this.project.lastRun

    this.project.expectedToFail = true

    assert.notEqual(code, 0, 'Cucumber was expected to fail, and passed.')
  }

  @then('the output contains {string}')
  @then('the output contains text:')
  public output(text: string): void {
    const { stdout } = this.project.lastRun

    assert.ok(contains(stdout, text), `The output does not contain ${text}:\n\n${stdout}`)
  }

  @then('the output contains {string} once')
  @then('the output contains text once:')
  public once(text: string): void {
    const { stdout } = this.project.lastRun

    assert.equal(occurrences(stdout, text), 1, `The output is not ${text} once:\n\n${stdout}`)
  }

  @then('the output does not contain {string}')
  @then('the output does not contain text:')
  public noOutput(text: string): void {
    const { stdout } = this.project.lastRun

    assert.ok(!stdout.includes(text), `The output contains ${text}:\n\n${stdout}`)
  }

  @then('the error output contains {string}')
  @then('the error output contains text:')
  public errors(text: string): void {
    const { stderr } = this.project.lastRun

    assert.ok(contains(stderr, text), `The error output does not contain ${text}:\n\n${stderr}`)
  }
}
