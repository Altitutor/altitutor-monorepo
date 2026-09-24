module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  moduleNameMapper: {
    '^@altitutor/ucat-response-contract$':
      '<rootDir>/../ucat-response-contract/src/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
