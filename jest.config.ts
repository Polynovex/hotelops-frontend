import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  // 'tests' was previously excluded, so anything placed there never ran.
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts']
};

export default config;
