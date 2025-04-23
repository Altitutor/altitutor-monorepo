module.exports = {
  extends: ['../../.eslintrc.js', 'plugin:@typescript-eslint/recommended', 'plugin:storybook/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/no-unescaped-entities': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'public/',
    'src-tauri/',
    '*.config.js',
  ],
} 