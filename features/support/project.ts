import { execFile } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Envelope } from '@cucumber/messages'

const ROOT = join(import.meta.dirname, '..', '..')

const CUCUMBER = join(ROOT, 'node_modules', '.bin', 'cucumber-js')

/**
 * Which decorators the projects under test are compiled with: `standard` for
 * the ones of TypeScript 5 and later, `legacy` for `experimentalDecorators`.
 * The suite is run once for each.
 */
const DECORATORS = process.env.PUPUMBER_DECORATORS ?? 'standard'

const MESSAGES = 'messages.ndjson'

/** What one run of Cucumber came to. */
export interface Run {
  code: number
  stdout: string
  stderr: string
  envelopes: Envelope[]
}

/**
 * A throwaway project on disk: the files a scenario describes, the node
 * modules they import, and the Cucumber run over them.
 */
export class Project {
  public path = ''

  private run?: Run

  /** Whether a failed run has been accounted for by the scenario. */
  public expectedToFail = false

  /** Empties the project directory and fills it with what every project needs. */
  public open(name: string): void {
    this.path = join(ROOT, 'tmp', name)

    rmSync(this.path, { recursive: true, force: true })
    mkdirSync(this.path, { recursive: true })

    this.write('package.json', JSON.stringify({ name: 'project', type: 'module' }))

    this.write(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          module: 'nodenext',
          moduleResolution: 'nodenext',
          strict: true,
          allowImportingTsExtensions: true,
          experimentalDecorators: DECORATORS === 'legacy',
        },
      })
    )

    this.link('pupumber', ROOT)
    this.link('@cucumber/cucumber', join(ROOT, 'node_modules', '@cucumber', 'cucumber'))
    this.link('tsx', join(ROOT, 'node_modules', 'tsx'))
  }

  public write(path: string, content: string): void {
    const file = join(this.path, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content, 'utf8')
  }

  public mkdir(path: string): void {
    mkdirSync(join(this.path, path), { recursive: true })
  }

  /** Runs Cucumber over the project, and keeps what came of it. */
  public async cucumber(env: NodeJS.ProcessEnv = {}): Promise<void> {
    const { code, stdout, stderr } = await this.spawn(env)

    this.run = { code, stdout: plain(stdout), stderr: plain(stderr), envelopes: this.envelopes() }
    this.expectedToFail = false
  }

  /** Whether Cucumber has been run over the project. */
  public get ran(): boolean {
    return this.run !== undefined
  }

  /** What the last run came to, which there has to have been one of. */
  public get lastRun(): Run {
    if (this.run === undefined) throw new Error('Cucumber has not been run yet.')

    return this.run
  }

  private spawn(env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise(resolve => {
      execFile(
        process.execPath,
        [
          '--import',
          'tsx',
          CUCUMBER,
          '--format',
          `message:${MESSAGES}`,
          '--import',
          'step_definitions/**/*.ts',
        ],
        { cwd: this.path, env: { ...process.env, ...env } },
        (error, stdout, stderr) => {
          const code = error === null ? 0 : Number((error as { code?: number }).code ?? 1)

          resolve({ code, stdout, stderr })
        }
      )
    })
  }

  private envelopes(): Envelope[] {
    let ndjson: string

    try {
      ndjson = readFileSync(join(this.path, MESSAGES), 'utf8')
    } catch {
      return []
    }

    return ndjson
      .split('\n')
      .filter(line => line !== '')
      .map(line => JSON.parse(line) as Envelope)
  }

  private link(name: string, target: string): void {
    const path = join(this.path, 'node_modules', name)

    mkdirSync(dirname(path), { recursive: true })
    symlinkSync(target, path)
  }
}

/** Cucumber colours its output, and a scenario asserts on the text. */
function plain(output: string): string {
  // oxlint-disable-next-line no-control-regex -- an escape sequence is one
  return output.replaceAll(/\u001B\[[\d;]*[A-Za-z]/g, '')
}
