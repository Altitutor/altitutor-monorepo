export function getLinkCopyBody(body: string): string | undefined {
  const links = new Set<string>();

  for (const match of body.matchAll(/\bhttps?:\/\/[^\s<>"`]+/gi)) {
    let link = match[0].replace(/[.,!?;:]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      const opens = link.split(open).length - 1;
      let closes = link.split(close).length - 1;
      while (link.endsWith(close) && closes > opens) {
        link = link.slice(0, -1);
        closes -= 1;
      }
    }
    try {
      new URL(link);
      links.add(link);
    } catch {
      // Ignore text that starts like a web link but is not a valid URL.
    }
  }

  return links.size ? [...links].join('\n') : undefined;
}
