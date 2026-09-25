"""Regression coverage for MARKETING-WEB-1 using the actual production export."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('extractor', Path(__file__).with_name('extract-marketing-content.py'))
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class LegacyScriptRegression(unittest.TestCase):
    def test_production_homepage_script_is_removed_without_losing_subsidy_copy(self):
        source = json.loads((extractor.ROOT / 'src/content/wordpress-pages.json').read_text())
        homepage = next(page for page in source if page['path'] == '/')
        self.assertIn("jQuery(function($)", homepage['html'])
        root = extractor.Parser(homepage['html']).root
        rendered = extractor.rich(root)
        self.assertNotIn('<script', rendered)
        self.assertNotIn('jQuery', rendered)
        self.assertIn('subsid', rendered.lower())

    def test_published_semantic_content_never_reintroduces_executable_markup(self):
        content = (extractor.ROOT / 'src/features/marketing/content/production.json').read_text()
        self.assertNotRegex(content, r'(?i)<script\b|jQuery\(|on(?:click|load|error)=')


if __name__ == '__main__':
    unittest.main()
