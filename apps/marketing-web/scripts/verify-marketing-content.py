"""Read-only content regression check against a running marketing site.

Usage: python3 scripts/verify-marketing-content.py http://127.0.0.1:3013
Checks all production paragraphs, list items, testimonials and tutor bios; ignores
only the explicitly listed UI instructions replaced by the new navigation.
"""
import json
from pathlib import Path
import re
import runpy
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
Parser = runpy.run_path(str(ROOT / 'scripts/extract-marketing-content.py'))['Parser']
CONTENT = json.loads((ROOT / 'src/features/marketing/content/production.json').read_text())
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3013'
PATHS = ['/', '/about/', '/about/contact/', '/classes/', '/resources/', '/about/subsidy/', '/about/apply/', '/about/testimonials/', '/privacy-policy/'] + [p for p in CONTENT if p.startswith('/classes/') and p != '/classes/']
# These are navigation labels, not student, course, policy or company copy.
REPLACED_UI = {('/', 'd5bc7a7'), ('/', 'a77e23b')}

def normalize(value):
    return re.sub(r'[^\w]', '', value).lower()

failures = []
count = 0
for path in PATHS:
    with urlopen(BASE.rstrip('/') + path, timeout=90) as response:
        html = response.read().decode()
    root = Parser(html).root
    mains = root.all(lambda n: n.tag == 'main')
    if len(mains) != 1:
        failures.append(f'{path}: expected one main landmark, found {len(mains)}')
        continue
    main = mains[0]
    # Next's serialized props must not count as rendered content.
    for script in main.all(lambda n: n.tag == 'script'):
        script.parent.children.remove(script)
    rendered = normalize(main.text())
    if len(main.all(lambda n: n.tag == 'h1')) != 1:
        failures.append(f'{path}: expected exactly one H1')
    for block in CONTENT[path]:
        if (path, block['id']) in REPLACED_UI:
            continue
        bodies = [block.get('html', ''), block.get('detailHtml', '')]
        bodies += [item['html'] for item in block.get('items', [])]
        for body in bodies:
            tree = Parser(body).root
            chunks = tree.all(lambda n: n.tag in ['p', 'li'])
            chunks = [n for n in chunks if not n.all(lambda c: c is not n and c.tag in ['p', 'li'])]
            texts = [n.text() for n in chunks] if chunks else [tree.text()]
            for text in texts:
                expected = normalize(text)
                if len(expected) < 10:
                    continue
                count += 1
                if expected not in rendered:
                    failures.append(f"{path} [{block['id']}]: missing {text[:130]}")
    ids = {n.attrs['id'] for n in root.all(lambda n: 'id' in n.attrs)}
    for link in main.all(lambda n: n.tag == 'a'):
        href = link.attrs.get('href', '')
        if href.startswith('#') and href[1:] not in ids:
            failures.append(f'{path}: broken section link {href}')
    print(f'Checked {path}')
print(f'Checked {count} production content passages across {len(PATHS)} routes.')
for failure in failures:
    print(f'FAIL {failure}')
sys.exit(1 if failures else 0)
