/**
 * Whether the output of a run contains a passage of text.
 *
 * Cucumber's progress formatter writes a dot per step, and wraps the line it
 * writes them on, so how many dots stand between two lines of a step's own
 * output is not something a scenario can state. A run of dots in the passage
 * matches a run of any length, and so does a run of spaces.
 */
export function contains(output: string, text: string): boolean {
  return output.includes(text) || flexible(text).test(output)
}

/** How many times the output contains a passage. */
export function occurrences(output: string, text: string): number {
  const exact = output.match(new RegExp(escape(text), 'g'))

  if (exact !== null) return exact.length

  return [...output.matchAll(new RegExp(flexible(text).source, 'gm'))].length
}

function flexible(text: string): RegExp {
  let pattern = ''

  for (let index = 0; index < text.length;) {
    const character = text[index]!

    if (character === '\r') {
      index += 1
      continue
    }

    if (character === '\n') {
      pattern += String.raw`\r?\n[. ]*`
      index += 1
      continue
    }

    if (character === '.' || character === ' ') {
      while (text[index] === character) index += 1

      pattern += character === '.' ? String.raw`\.+` : ' +'
      continue
    }

    pattern += escape(character)
    index += 1
  }

  return new RegExp(pattern, 'm')
}

function escape(text: string): string {
  return text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`)
}
