export function DocumentReader({ html, background }: { html: string; background: string }) {
  return (
    <iframe
      title="Document contents"
      srcDoc={html.replaceAll('<a href=', '<a target="_blank" rel="noopener noreferrer" href=')}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ flex: 1, width: '100%', border: 0, background }}
    />
  );
}
