import assert from 'node:assert/strict'
import type { DataTable } from '@cucumber/cucumber'
import { binding, then } from 'pupumber'
import { Project } from '../support/project.ts'
import { Report } from '../support/report.ts'

@binding([Project])
export default class ReportSteps {
  private readonly project: Project

  constructor(project: Project) {
    this.project = project
  }

  private get report(): Report {
    return new Report(this.project.lastRun.envelopes)
  }

  @then('scenario {string} step {string} has the logs:')
  public logs(scenario: string, step: string, table: DataTable): void {
    const logged = Report.logs(this.report.attachmentsOfStep(scenario, step))

    assert.deepEqual(
      logged,
      table.raw().map(row => row[0])
    )
  }

  @then('scenario {string} step {string} has no attachments')
  public none(scenario: string, step: string): void {
    assert.deepEqual(this.report.attachmentsOfStep(scenario, step), [])
  }

  @then('scenario {string} step {string} has the attachments:')
  public attachments(scenario: string, step: string, table: DataTable): void {
    assert.deepEqual(simplify(this.report.attachmentsOfStep(scenario, step)), expected(table))
  }

  @then('scenario {string} {string} hook has the attachments:')
  public hookAttachments(scenario: string, keyword: string, table: DataTable): void {
    const attachments = this.report.attachmentsOfHook(scenario, keyword as 'Before' | 'After')

    assert.deepEqual(simplify(attachments), expected(table))
  }

  @then('the hook {string} was executed on scenario {string}')
  public hook(name: string, scenario: string): void {
    assert.equal(this.report.runsOfHook(name, scenario), 1)
  }

  @then('the step {string} is defined at {string}')
  public location(pattern: string, location: string): void {
    assert.equal(this.report.locationOfStep(pattern), location)
  }
}

interface Simple {
  body: string
  mediaType: string
  contentEncoding: string
}

function simplify(
  attachments: { body: string; mediaType: string; contentEncoding: string }[]
): Simple[] {
  return attachments.map(({ body, mediaType, contentEncoding }) => ({
    body,
    mediaType,
    contentEncoding,
  }))
}

function expected(table: DataTable): Simple[] {
  return table.hashes().map(row => ({
    body: row.DATA!,
    mediaType: row['MEDIA TYPE']!,
    contentEncoding: row['MEDIA ENCODING']!,
  }))
}
