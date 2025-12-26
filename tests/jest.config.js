module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/unit/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/integration/',
    '/e2e/',
    '.spec.ts$'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  collectCoverageFrom: [
    '../ui/smarthome-ui/src/lib/commands.ts',
    '../ui/smarthome-ui/src/lib/logger.ts',
    '../ui/smarthome-ui/src/lib/env.ts',
    '../ui/smarthome-ui/src/lib/qos-policy.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/mqtt.ts$',
    '/metrics.ts$',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../ui/smarthome-ui/src/$1',
  },
};
