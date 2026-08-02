/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    // Shared package main entry points at dist/; map to source so tests work without a build.
    '^@altitutor/shared$': '<rootDir>/../shared/src/index.ts',
    '^@altitutor/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  passWithNoTests: true,
};
