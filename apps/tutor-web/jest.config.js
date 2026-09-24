/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@altitutor/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@altitutor/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@altitutor/ui$': '<rootDir>/../../packages/ui/src/index.ts',
    '^@altitutor/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
    // Workspace packages point at dist/; map to source so tests work without a build (CI).
    '^@altitutor/ucat-response-contract$':
      '<rootDir>/../../packages/ucat-response-contract/src/index.ts',
    '^@altitutor/ucat-response-contract/(.*)$':
      '<rootDir>/../../packages/ucat-response-contract/src/$1',
    '^@altitutor/ucat-blueprint$':
      '<rootDir>/../../packages/ucat-blueprint/src/index.ts',
    '^@altitutor/ucat-blueprint/(.*)$':
      '<rootDir>/../../packages/ucat-blueprint/src/$1',
    '^@altitutor/ucat-percentiles$':
      '<rootDir>/../../packages/ucat-percentiles/src/index.ts',
    '^@altitutor/ucat-percentiles/(.*)$':
      '<rootDir>/../../packages/ucat-percentiles/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  passWithNoTests: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};

module.exports = config;

