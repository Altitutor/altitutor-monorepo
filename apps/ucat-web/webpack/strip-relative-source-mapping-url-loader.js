/**
 * Removes relative `//# sourceMappingURL=...` comments from node_modules ESM.
 *
 * Packages like framer-motion/motion ship comments such as
 * `//# sourceMappingURL=LayoutGroupContext.mjs.map`. After webpack bundles them
 * into `/_next/static/chunks/...`, DevTools resolves that path relative to the
 * chunk URL, receives Next's HTML 404 page, and throws:
 * `SyntaxError: Invalid or unexpected token` (or `Unexpected token '<'`).
 *
 * Webpack already attaches its own `data:` source maps for these modules.
 */
module.exports = function stripRelativeSourceMappingUrl(source) {
  if (typeof source !== "string") {
    return source;
  }

  return source.replace(/\/\/[#@]\s*sourceMappingURL=(?!data:)[^\s]+/g, "");
};
