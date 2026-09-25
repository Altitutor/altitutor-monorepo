from html.parser import HTMLParser

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
