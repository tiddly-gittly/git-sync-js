/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs-extra';
import { GitProcess } from 'dugite';
// eslint-disable-next-line unicorn/prevent-abbreviations
import { dir } from './constants';

beforeAll(async () => {
  return await setUpMockGitRepositories();
});

afterAll(async () => {
  return await resetMockGitRepositories();
});

async function setUpMockGitRepositories() {
  if (!(await fs.pathExists(dir))) {
    await fs.mkdir(dir);
  }
  await GitProcess.exec(['init'], dir);
}

async function resetMockGitRepositories() {
  await fs.remove(dir);
}
