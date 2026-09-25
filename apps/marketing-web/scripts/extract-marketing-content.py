"""Extract production copy into semantic content, without Elementor layout or scripts.

Run from any directory with Python 3. Source is the checked-in production export.
Page layouts deliberately live in features/marketing/pages, not this content file.
"""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
REDIRECTS = json.loads((ROOT / 'src/lib/legacy-redirects.json').read_text())

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def text(self):
        return ''.join(c if isinstance(c, str) else c.text() for c in self.children)
    def all(self, predicate):
        result = [self] if predicate(self) else []
        for child in self.children:
            if isinstance(child, Node):
                result.extend(child.all(predicate))
        return result
    def cls(self, name):
        return self.all(lambda n: name in n.attrs.get('class', '').split())

class Parser(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.root = self.node = Node()
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.node)
        self.node.children.append(node)
        if tag not in ['img', 'input', 'meta', 'link', 'br', 'hr', 'source', 'wbr', 'embed', 'area']:
            self.node = node
    def handle_endtag(self, tag):
        node = self.node
        while node.parent:
            if node.tag == tag:
                self.node = node.parent
                break
            node = node.parent
    def handle_data(self, value):
        self.node.children.append(value)

def clean(value):
    return re.sub(r'\s+', ' ', value).strip()

def url(value):
    value = re.sub(r'^https?://(?:www\.)?altitutor\.com/', '/', value)
    if value.startswith(('javascript:', 'data:')):
        return ''
    if value in REDIRECTS['trialBookingPaths']:
        return REDIRECTS['trialBookingUrl']
    return REDIRECTS['pageRedirects'].get(value, value)

def rich(node):
    if isinstance(node, str):
        return escape(node, quote=False)
    if node.tag in ['svg', 'script', 'style', 'iframe', 'img']:
        return ''
    if 'elementor-screen-only' in node.attrs.get('class', ''):
        return ''
    body = ''.join(rich(c) for c in node.children)
    tag = node.tag
    if tag == 'br':
        return '<br />'
    if tag == 'a':
        href = url(node.attrs.get('href', ''))
        return f'<a href="{escape(href, quote=True)}">{body}</a>' if href else body
    if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
        tag = 'h3'
    if tag in ['p', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'h3', 'blockquote']:
        return f'<{tag}>{body}</{tag}>'
    return body

def first(nodes):
    return nodes[0] if nodes else Node()

def text_class(node, name):
    return clean(first(node.cls(name)).text())

def body_class(node, name):
    return clean(rich(first(node.cls(name))))

def extract(node):
    kind = node.attrs['data-widget_type'].split('.')[0]
    block = dict(id=node.attrs['data-id'], kind=kind)
    if kind in ['heading', 'animated-headline']:
        block['title'] = clean(node.text())
    elif kind == 'text-editor':
        block['html'] = body_class(node, 'elementor-widget-container')
        if block['id'] == '27683c5':
            # This instruction referred to a removed decorative expansion arrow.
            block['html'] = re.sub(r'<p>[^<]*(?:<(?:strong|b)>)*Click on the arrow.*?</p>', '', block['html'])
    elif kind in ['icon-box', 'image-box']:
        block['title'] = text_class(node, f'elementor-{kind}-title')
        block['html'] = body_class(node, f'elementor-{kind}-description')
    elif kind == 'icon-list':
        block['html'] = '<ul>' + ''.join('<li>'+rich(n)+'</li>' for n in node.cls('elementor-icon-list-text')) + '</ul>'
    elif kind == 'flip-box':
        titles = node.cls('elementor-flip-box__layer__title')
        descriptions = node.cls('elementor-flip-box__layer__description')
        block['title'] = clean(first(titles).text())
        block['html'] = clean(rich(first(descriptions)))
        block['detailTitle'] = clean(titles[1].text()) if len(titles) > 1 else ''
        block['detailHtml'] = clean(rich(descriptions[1])) if len(descriptions) > 1 else ''
    elif kind == 'call-to-action':
        block['title'] = text_class(node, 'elementor-cta__title')
        block['html'] = body_class(node, 'elementor-cta__description')
        bg = first(node.cls('elementor-cta__bg')).attrs.get('style', '')
        match = re.search(r'url\((.*?)\)', bg)
        if match:
            block['image'] = url(match[1].strip('"\''))
    elif kind == 'accordion':
        block['items'] = [dict(title=text_class(n, 'elementor-accordion-title'), html=body_class(n, 'elementor-tab-content')) for n in node.cls('elementor-accordion-item')]
    elif kind == 'testimonial-carousel':
        block['items'] = [dict(title=text_class(n, 'elementor-testimonial__name'), html=body_class(n, 'elementor-testimonial__text'), role=text_class(n, 'elementor-testimonial__title')) for n in node.cls('elementor-testimonial')]
    elif kind == 'counter':
        block['title'] = text_class(node, 'elementor-counter-title')
        block['value'] = first(node.cls('elementor-counter-number')).attrs.get('data-to-value', '') + text_class(node, 'elementor-counter-number-suffix')
    elif kind == 'button':
        block['title'] = clean(node.text())
    elif kind == 'google_maps':
        block['href'] = first(node.all(lambda n: n.tag == 'iframe')).attrs.get('src', '')
    elif kind != 'image':
        return None
    images = node.all(lambda n: n.tag == 'img')
    if images:
        block['image'] = url(images[0].attrs.get('src', ''))
        block['alt'] = images[0].attrs.get('alt', '')
    links = node.all(lambda n: n.tag == 'a' and n.attrs.get('href'))
    if links:
        block['href'] = url(links[-1].attrs['href'])
    return block

if __name__ == '__main__':
    source = json.loads((ROOT / 'src/content/wordpress-pages.json').read_text())
    output = {}
    for page in source:
        root = Parser(page['html']).root
        # Production removes these outdated booking sections in favour of the waitlist.
        if page['path'] == '/classes/medical-interview-preparation/':
            for node in root.all(lambda n: n.attrs.get('data-id') in ['e1266e4', '8d9ab25']):
                node.parent.children.remove(node)
        blocks = [extract(n) for n in root.all(lambda n: 'data-widget_type' in n.attrs)]
        output[page['path']] = [b for b in blocks if b]
    target = ROOT / 'src/features/marketing/content/production.json'
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    print(f'Extracted {sum(map(len, output.values()))} content blocks into {target}')
