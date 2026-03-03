/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  passWithNoTests: true,
};
