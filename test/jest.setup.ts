/* eslint-disable @typescript-eslint/promise-function-async */
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

export async function setUpMockGitRepositories() {
  await Promise.all([
    // simulate situation that local repo is initialized first, and upstream repo (Github) is empty & bare, and is initialized later
    fs.mkdirp(dir).then(() => initGitWithBranch(dir, defaultGitInfo.branch, { initialCommit: true })),
    fs.mkdirp(upstreamDir).then(() => initGitWithBranch(upstreamDir, defaultGitInfo.branch, { initialCommit: false, bare: true })),
  ]);
}

export async function resetMockGitRepositories() {
  await Promise.all([
    fs.remove(dir),
    fs.remove(upstreamDir),
  ]);
}
