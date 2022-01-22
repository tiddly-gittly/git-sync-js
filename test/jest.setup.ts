/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable unicorn/prefer-module */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs-extra';
import path from 'path';
import { GitProcess } from 'dugite';

/**
 * mockRepoLocation
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const dir = path.join(__dirname, 'mockRepo');

beforeAll(async () => {
  return await setUpMockGitRepositories();
});

beforeAll(async () => {
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
