const URL_DELIMITERS: Readonly<Record<string, string>> = { '<': '>', '"': '"', '`': '`' };

export function getLinkCopyBody(body: string): string | undefined {
  const links = new Set<string>();

  for (const line of body.split('\n')) {
    const text = line.trim();
    for (const match of text.matchAll(/\bhttps?:\/\/[^\s<>"`]+/gi)) {
      const candidate = match[0];
      const start = match.index;
      let link = candidate;
      const closer = URL_DELIMITERS[text[start - 1]];
      const isDelimited = closer && text[start + candidate.length] === closer;
      if (candidate !== text && !isDelimited) {
        link = link.replace(/[.,!?;:]+$/, '');
        if (text[start - 1] === "'" && link.endsWith("'")) link = link.slice(0, -1);
        for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
          const opens = link.split(open).length - 1;
          let closes = link.split(close).length - 1;
          while (link.endsWith(close) && closes > opens) {
            link = link.slice(0, -1);
            closes -= 1;
          }
        }
      }

      try {
        new URL(link);
        links.add(link);
      } catch {
        // Ignore text that starts like a web link but is not a valid URL.
      }
    }
  }

  return links.size ? [...links].join('\n') : undefined;
}
