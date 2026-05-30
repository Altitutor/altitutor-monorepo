module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@altitutor/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@altitutor/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1",
    "^@altitutor/ui$": "<rootDir>/../../packages/ui/src/index.ts",
    "^@altitutor/ui/(.*)$": "<rootDir>/../../packages/ui/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-big-calendar|date-fns|@tiptap|marked)/)",
  ],
};
