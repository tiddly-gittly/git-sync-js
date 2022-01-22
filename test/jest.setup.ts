/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs-extra';
// eslint-disable-next-line unicorn/prevent-abbreviations
import { dir } from './constants';
import { initGitWithBranch } from '../src/init';

beforeEach(async () => {
  await resetMockGitRepositories();
  return await setUpMockGitRepositories();
});

// afterAll(async () => {
//   return await resetMockGitRepositories();
// });

async function setUpMockGitRepositories() {
  if (!(await fs.pathExists(dir))) {
    await fs.mkdir(dir);
  }
  await initGitWithBranch(dir);
}

async function resetMockGitRepositories() {
  await fs.remove(dir);
}
