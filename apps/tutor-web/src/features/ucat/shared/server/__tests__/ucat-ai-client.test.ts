import { parseUcatAiJsonContent } from '../ucat-ai-client'

describe('parseUcatAiJsonContent', () => {
  it('parses direct JSON', () => {
    expect(parseUcatAiJsonContent('{"stems":[]}')).toEqual({ stems: [] })
  })

  it('parses JSON code fences', () => {
    expect(parseUcatAiJsonContent('```json\n{"stems":[]}\n```')).toEqual({ stems: [] })
  })

  it('extracts a JSON object surrounded by harmless prose', () => {
    expect(parseUcatAiJsonContent('Result:\n{"stems":[]}\nDone.')).toEqual({ stems: [] })
  })

  it('does not repair malformed JSON', () => {
    expect(() => parseUcatAiJsonContent('```json\n{"stems":[}\n```')).toThrow()
  })
})
