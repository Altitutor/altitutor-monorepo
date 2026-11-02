// Shared flat configs are imported by each web/library workspace. Keeping this
// file outside ESLint's automatic filenames lets native ESLint 8 retain Expo's
// existing local legacy config until the separate native tooling migration.
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export const typescriptConfig = [
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/.next*/**', '**/out/**',
      '**/public/**', '**/.scripts-dist/**', '**/*.config.{js,cjs,mjs}',
      '**/coverage/**', '**/playwright-report/**', '**/test-results/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', '.tmp-*-check.mjs'],
    rules: { 'no-console': ['warn', { allow: ['log', 'info', 'warn', 'error'] }] },
  },
  {
    files: [
      '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}',
    ],
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
  },
];

// Preserve the established two hook rules while migrating frameworks. The
// additional React Compiler diagnostics are a separate adoption boundary, since
// resolving them can change existing effects, refs and component lifetimes.
const establishedHookRules = new Set([
  'react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps',
]);
const nextWithoutCompilerDiagnostics = nextVitals.map((config) => ({
  ...config,
  ...(config.rules && {
    rules: Object.fromEntries(Object.entries(config.rules).filter(([name]) =>
      !name.startsWith('react-hooks/') || establishedHookRules.has(name),
    )),
  }),
}));

export const webConfig = [
  ...nextWithoutCompilerDiagnostics,
  ...typescriptConfig,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
