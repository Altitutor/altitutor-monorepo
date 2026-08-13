module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['@swc/jest'],
  },
  moduleNameMapper: {
    '^@altitutor/ucat-response-contract$':
      '<rootDir>/../ucat-response-contract/src/index.ts',
  },
}
