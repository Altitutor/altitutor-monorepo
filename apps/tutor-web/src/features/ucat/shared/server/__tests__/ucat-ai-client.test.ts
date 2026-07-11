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

  it('repairs an omitted final root closing brace for a completed generation response', () => {
    expect(parseUcatAiJsonContent('{"stems":[]}')).toEqual({ stems: [] })
    expect(parseUcatAiJsonContent('{"stems":[]')).toEqual({ stems: [] })
  })

  it('repairs a missing closing bracket for a generated table rows array', () => {
    expect(parseUcatAiJsonContent('{"stems":[{"stemText":[{"type":"table","columns":["A"],"rows":[["1"]},{"type":"paragraph","text":"Done"}]}]}'))
      .toEqual({
        stems: [{
          stemText: [
            { type: 'table', columns: ['A'], rows: [['1']] },
            { type: 'paragraph', text: 'Done' },
          ],
        }],
      })
  })

  it('removes an extra object closer between generated content blocks', () => {
    expect(parseUcatAiJsonContent('{"stems":[{"stemText":[{"type":"paragraph","text":"First"}},{"type":"paragraph","text":"Second"}]}]}'))
      .toEqual({
        stems: [{
          stemText: [
            { type: 'paragraph', text: 'First' },
            { type: 'paragraph', text: 'Second' },
          ],
        }],
      })
  })

  it('repairs the malformed table-to-paragraph transition seen in completed writer output', () => {
    expect(parseUcatAiJsonContent('{"stems":[{"stemText":"Stem","questions":[{"questionText":"Question","answerExplanation":[{"type":"table","columns":["A"],"rows":[["1"]}],"},{"type":"paragraph","text":"Done"}],"options":[{"answerText":"A","isAnswer":true}]}]}]}'))
      .toMatchObject({
        stems: [{
          questions: [{
            answerExplanation: [
              { type: 'table', rows: [['1']] },
              { type: 'paragraph', text: 'Done' },
            ],
          }],
        }],
      })
  })

  it('does not repair structurally malformed JSON', () => {
    expect(() => parseUcatAiJsonContent('```json\n{"stems":[}\n```')).toThrow()
  })
})
