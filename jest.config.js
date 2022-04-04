/* eslint-disable unicorn/prefer-module */
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
