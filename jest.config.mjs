/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@girardelli/architect-core/(.*)\\.js$': '<rootDir>/packages/architect-core/$1',
    '^@girardelli/architect-agents/(.*)\\.js$': '<rootDir>/packages/architect-agents/$1'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.base.json'
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
};
