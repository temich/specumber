import { formatterHelpers } from '@cucumber/cucumber'
import type {
  Attachment,
  Envelope,
  GherkinDocument,
  Hook,
  Pickle,
  StepDefinition,
  TestCase,
  TestCaseStarted,
  TestStep,
} from '@cucumber/messages'

const { getGherkinStepMap } = formatterHelpers.GherkinDocumentParser
const { getStepKeyword } = formatterHelpers.PickleParser

/** The messages of one Cucumber run, answering what a scenario asks of them. */
export class Report {
  private readonly envelopes: Envelope[]

  constructor(envelopes: Envelope[]) {
    this.envelopes = envelopes
  }

  /** What was attached to a step, in the order it was attached. */
  public attachmentsOfStep(scenario: string, step: string): Attachment[] {
    const pickle = this.pickle(scenario)
    const testCase = this.testCase(pickle.id)
    const pickleStep = this.pickleStep(pickle, step)

    const testStep = testCase.testSteps.find(candidate => candidate.pickleStepId === pickleStep.id)!

    return this.attachments(testCase, testStep)
  }

  /**
   * What was attached to the hook of the scenario.
   *
   * The first `Before` and the last `After` are Pupumber's own, which set the
   * scenario up and take it down; the ones asked about here are the next in.
   */
  public attachmentsOfHook(scenario: string, keyword: 'Before' | 'After'): Attachment[] {
    const testCase = this.testCase(this.pickle(scenario).id)

    const index = keyword === 'Before' ? 1 : testCase.testSteps.length - 2

    return this.attachments(testCase, testCase.testSteps[index]!)
  }

  /** The text of every log attachment, which is how `CucumberLog` arrives. */
  public static logs(attachments: Attachment[]): string[] {
    return attachments
      .filter(attachment => attachment.mediaType === 'text/x.cucumber.log+plain')
      .map(attachment => attachment.body)
  }

  /** How many times a named hook ran on a scenario. */
  public runsOfHook(name: string, scenario: string): number {
    const hook = this.envelopes.find(({ hook: candidate }) => candidate?.name === name)?.hook

    if (hook === undefined) throw new Error(`No hook named ${name} was registered.`)

    return this.executions(scenario, hook)
  }

  /** Where Cucumber says a step definition is, as `path:line`. */
  public locationOfStep(pattern: string): string {
    const definition = this.envelopes
      .map(({ stepDefinition }) => stepDefinition)
      .find((candidate): candidate is StepDefinition => candidate?.pattern.source === pattern)

    if (definition === undefined) throw new Error(`No step definition for ${pattern}.`)

    const { uri, location } = definition.sourceReference

    return `${uri}:${location?.line}`
  }

  private executions(scenario: string, hook: Hook): number {
    const testCase = this.testCase(this.pickle(scenario).id)

    return testCase.testSteps.filter(step => step.hookId === hook.id).length
  }

  private attachments(testCase: TestCase, testStep: TestStep): Attachment[] {
    const started = this.testCaseStarted(testCase.id)

    return this.envelopes
      .map(({ attachment }) => attachment)
      .filter(
        attachment =>
          attachment !== undefined &&
          attachment.testCaseStartedId === started.id &&
          attachment.testStepId === testStep.id
      ) as Attachment[]
  }

  private pickle(name: string): Pickle {
    const pickle = this.envelopes.find(({ pickle: candidate }) => candidate?.name === name)?.pickle

    if (pickle === undefined) throw new Error(`The run has no scenario named ${name}.`)

    return pickle
  }

  private pickleStep(pickle: Pickle, text: string) {
    const document = this.document(pickle.uri)
    const steps = getGherkinStepMap(document)

    const step = pickle.steps.find(
      candidate =>
        `${getStepKeyword({ pickleStep: candidate, gherkinStepMap: steps })}${candidate.text}` ===
        text
    )

    if (step === undefined) throw new Error(`The scenario has no step ${text}.`)

    return step
  }

  private document(uri: string): GherkinDocument {
    const document = this.envelopes.find(
      ({ gherkinDocument }) => gherkinDocument?.uri === uri
    )?.gherkinDocument

    if (document === undefined) throw new Error(`The run has no document ${uri}.`)

    return document
  }

  private testCase(pickleId: string): TestCase {
    const testCase = this.envelopes.find(
      ({ testCase: candidate }) => candidate?.pickleId === pickleId
    )?.testCase

    if (testCase === undefined) throw new Error(`Nothing ran for the pickle ${pickleId}.`)

    return testCase
  }

  private testCaseStarted(testCaseId: string): TestCaseStarted {
    const started = this.envelopes.find(
      ({ testCaseStarted }) => testCaseStarted?.testCaseId === testCaseId
    )?.testCaseStarted

    if (started === undefined) throw new Error(`Nothing started for the test case ${testCaseId}.`)

    return started
  }
}
