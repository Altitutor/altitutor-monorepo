module.exports = {
  maxWorkers: 2,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
