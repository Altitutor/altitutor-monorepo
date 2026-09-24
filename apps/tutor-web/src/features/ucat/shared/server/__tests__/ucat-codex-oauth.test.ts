import { buildCodexOAuthRequestBody } from '../ucat-codex-oauth'

describe('buildCodexOAuthRequestBody', () => {
  it('requests transport-level JSON output without unsupported output-token parameters', () => {
    const body = buildCodexOAuthRequestBody({
      model: 'gpt-5.6-terra',
      systemPrompt: 'Return JSON.',
      userPrompt: 'Review this stem.',
    })

    expect(body).toMatchObject({
      model: 'gpt-5.6-terra',
      text: {
        format: { type: 'json_object' },
        verbosity: 'low',
      },
    })
    expect(body).not.toHaveProperty('max_output_tokens')
    expect(body.input[0]?.content).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'input_text',
        text: expect.stringMatching(/json/iu),
      }),
    ]))
  })

  it('adds the JSON directive without dropping multimodal review content', () => {
    const image = {
      type: 'input_image' as const,
      image_url: 'data:image/png;base64,abc',
      detail: 'high' as const,
    }
    const prompt = { type: 'input_text' as const, text: 'Review the chart.' }

    const body = buildCodexOAuthRequestBody({
      model: 'gpt-5.6-terra',
      systemPrompt: 'Return structured output.',
      userPrompt: prompt.text,
      userContentParts: [prompt, image],
    })

    expect(body.input[0]?.content).toEqual([
      { type: 'input_text', text: 'Return the response as JSON.' },
      prompt,
      image,
    ])
  })
})
