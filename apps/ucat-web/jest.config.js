module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/index.ts",
    "!src/app/**/{layout,loading,error,global-error,not-found}.tsx",
    "!src/instrumentation*.ts",
    "!src/sentry.*.config.ts",
  ],
  coverageThreshold: {
    "./": {
      branches: 67,
      functions: 47,
      lines: 32,
      statements: 32,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@altitutor/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@altitutor/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1",
    "^@altitutor/ui$": "<rootDir>/../../packages/ui/src/index.ts",
    "^@altitutor/ui/(.*)$": "<rootDir>/../../packages/ui/src/$1",
    "^@altitutor/ucat-marking$":
      "<rootDir>/../../packages/ucat-marking/src/index.ts",
    "^@altitutor/ucat-marking/(.*)$":
      "<rootDir>/../../packages/ucat-marking/src/$1",
    "^@altitutor/ucat-percentiles$":
      "<rootDir>/../../packages/ucat-percentiles/src/index.ts",
    "^@altitutor/ucat-percentiles/(.*)$":
      "<rootDir>/../../packages/ucat-percentiles/src/$1",
    // Shared/marking import this; map to source so tests work without a package build (CI).
    "^@altitutor/ucat-response-contract$":
      "<rootDir>/../../packages/ucat-response-contract/src/index.ts",
    "^@altitutor/ucat-response-contract/(.*)$":
      "<rootDir>/../../packages/ucat-response-contract/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(react-big-calendar|date-fns|@tiptap|marked)@)",
    "node_modules/(?!.pnpm|react-big-calendar|date-fns|@tiptap|marked)",
  ],
};
