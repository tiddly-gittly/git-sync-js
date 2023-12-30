/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs-extra';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { initGitWithBranch } from '../src/init';
import { dir, setGlobalConstants, upstreamDir } from './constants';

beforeEach(async () => {
  setGlobalConstants();
  await resetMockGitRepositories();
  await setUpMockGitRepositories();
}, 40_000);

// afterAll(async () => {
//   return await resetMockGitRepositories();
// });

async function setUpMockGitRepositories() {
  if (!(await fs.pathExists(dir))) {
    await fs.mkdirp(dir);
  }
  if (!(await fs.pathExists(upstreamDir))) {
    await fs.mkdirp(upstreamDir);
  }
  await initGitWithBranch(dir);
  await initGitWithBranch(upstreamDir, defaultGitInfo.branch);
}

async function resetMockGitRepositories() {
  await fs.remove(dir);
  await fs.remove(upstreamDir);
}
