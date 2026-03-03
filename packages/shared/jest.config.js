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
  passWithNoTests: true,
};
