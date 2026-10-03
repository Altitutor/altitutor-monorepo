/** Apply existing Tailwind breakpoints to the pane width inside the admin workspace.
 * Header/navigation and portalled dialogs continue using viewport breakpoints. */
module.exports = () => ({
  postcssPlugin: 'admin-panel-responsive',
  OnceExit(root) {
    root.walkAtRules('media', rule => {
      if (!/^\((?:min|max)-width:\s*[\d.]+(?:px|rem)\)$/.test(rule.params)) return;
      const container = rule.clone({ name: 'container', params: `admin-pane ${rule.params}` });
      rule.walkRules(style => {
        style.selectors = style.selectors.map(selector => `${selector}:not(:where(.admin-responsive-pane *))`);
      });
      rule.after(container);
    });
  },
});
module.exports.postcss = true;
