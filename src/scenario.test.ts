import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ScenarioInfo } from './scenario.ts'

describe('flags', () => {
  it('reads a tag that carries nothing', () => {
    const info = new ScenarioInfo('a scenario', ['@slow'])

    assert.equal(info.getFlag('slow'), true)
    assert.equal(info.getFlag('fast'), false)
  })

  it('does not read a tag that carries a value as a flag', () => {
    const info = new ScenarioInfo('a scenario', ['@retries(2)'])

    assert.equal(info.getFlag('retries'), false)
  })
})

describe('options', () => {
  it('reads the value of a tag', () => {
    const info = new ScenarioInfo('a scenario', ['@browser(firefox)'])

    assert.equal(info.getOptionTag('browser'), 'firefox')
    assert.equal(info.getOptionTag('device'), undefined)
  })

  it('reads the last of the values a tag carries', () => {
    const info = new ScenarioInfo('a scenario', ['@browser(firefox)', '@browser(chrome)'])

    assert.equal(info.getOptionTag('browser'), 'chrome')
  })

  it('reads every value a tag carries, in the order of the tags', () => {
    const info = new ScenarioInfo('a scenario', ['@browser(firefox)', '@browser(chrome)'])

    assert.deepEqual(info.getMultiOptionTag('browser'), ['firefox', 'chrome'])
    assert.deepEqual(info.getMultiOptionTag('device'), [])
  })
})

describe('attributes', () => {
  it('reads the value of a tag as JSON', () => {
    const info = new ScenarioInfo('a scenario', ['@window({"width":800})'])

    assert.deepEqual(info.getAttributeTag('window'), { width: 800 })
  })

  it('reads nothing from a tag whose value is not JSON', () => {
    const info = new ScenarioInfo('a scenario', ['@browser(firefox)'])

    assert.equal(info.getAttributeTag('browser'), undefined)
  })

  it('reads the last of the values a tag carries', () => {
    const info = new ScenarioInfo('a scenario', ['@window(1)', '@window(2)'])

    assert.equal(info.getAttributeTag('window'), 2)
  })
})

describe('tags', () => {
  it('takes a tag with or without its at sign', () => {
    const info = new ScenarioInfo('a scenario', ['slow', '@browser(firefox)'])

    assert.equal(info.getFlag('slow'), true)
    assert.equal(info.getOptionTag('browser'), 'firefox')
  })
})
