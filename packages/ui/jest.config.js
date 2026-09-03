/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    // Shared package main entry points at dist/; map to source so tests work without a build.
    '^@altitutor/shared$': '<rootDir>/../shared/src/index.ts',
    '^@altitutor/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@altitutor/ucat-response-contract$': '<rootDir>/../ucat-response-contract/src/index.ts',
    '^@altitutor/ucat-response-contract/(.*)$': '<rootDir>/../ucat-response-contract/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
  },
  passWithNoTests: true,
};
