/** A Cucumber tag name, such as `@slow`. */
export type TagName = string

/** `@name(value)`, the shape every parameterised tag is read from. */
const PARAMETERISED = /^@?(?<name>[\w-]+)\((?<value>.+?)\)$/s

/** `@name`, a tag carrying nothing but itself. */
const FLAG = /^@?(?<name>[\w-]+)$/s

/**
 * What the running scenario is, and what its tags say.
 *
 * Cucumber applies a feature's tags to every scenario in it, so `tags` holds
 * both, with no way to tell one source from the other — see
 * [tag inheritance](https://cucumber.io/docs/cucumber/api/#tag-inheritance).
 *
 * Request it as a context type to have it injected:
 *
 * ```ts
 * @binding([ScenarioInfo])
 * class Steps {
 *   constructor(private readonly scenario: ScenarioInfo) {}
 * }
 * ```
 */
export class ScenarioInfo {
  /** Lazily parsed: a scenario that asks for none of these pays for none. */
  private attributes?: Map<string, unknown>
  private options?: Map<string, string[]>
  private flags?: Set<string>

  /** The title of the running scenario. */
  public readonly scenarioTitle: string

  /** The tags of the scenario and of its feature, in that order. */
  public readonly tags: TagName[]

  constructor(scenarioTitle: string, tags: TagName[]) {
    this.scenarioTitle = scenarioTitle
    this.tags = tags
  }

  /** Whether the tag `@name` is on the scenario or its feature. */
  public getFlag(name: string): boolean {
    this.flags ??= parseFlags(this.tags)

    return this.flags.has(name)
  }

  /**
   * The value of `@name(value)` as text, or `undefined` if the tag is absent.
   * The last occurrence wins, which is the scenario's own when the feature
   * carries one too.
   */
  public getOptionTag(name: string): string | undefined {
    this.options ??= parseOptions(this.tags)

    return this.options.get(name)?.at(-1)
  }

  /** Every value of `@name(value)`, in the order the tags were read. */
  public getMultiOptionTag(name: string): string[] {
    this.options ??= parseOptions(this.tags)

    return this.options.get(name) ?? []
  }

  /**
   * The value of `@name(value)` parsed as JSON, or `undefined` if the tag is
   * absent or its value is not JSON. The last occurrence wins.
   */
  public getAttributeTag(name: string): unknown {
    this.attributes ??= parseAttributes(this.tags)

    return this.attributes.get(name)
  }
}

function parseOptions(tags: TagName[]): Map<string, string[]> {
  const options = new Map<string, string[]>()

  for (const tag of tags) {
    const match = PARAMETERISED.exec(tag)?.groups

    if (match === undefined) continue

    const values = options.get(match.name!)

    if (values === undefined) options.set(match.name!, [match.value!])
    else values.push(match.value!)
  }

  return options
}

function parseAttributes(tags: TagName[]): Map<string, unknown> {
  const attributes = new Map<string, unknown>()

  for (const tag of tags) {
    const match = PARAMETERISED.exec(tag)?.groups

    if (match === undefined) continue

    // `@foo(bar)` is an option tag, not an attribute tag: it is not JSON, and
    // reading it as one is the caller asking the wrong question of the tag.
    const value = json(match.value!)

    if (value !== NOT_JSON) attributes.set(match.name!, value)
  }

  return attributes
}

/** What `json` answers for text that is not JSON, `undefined` being a value. */
const NOT_JSON = Symbol('not json')

function json(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return NOT_JSON
  }
}

function parseFlags(tags: TagName[]): Set<string> {
  const flags = new Set<string>()

  for (const tag of tags) {
    const name = FLAG.exec(tag)?.groups?.name

    if (name !== undefined) flags.add(name)
  }

  return flags
}
