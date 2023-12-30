/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs-extra';
import { clone } from '../src/clone';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { getDefaultBranchName, getSyncState, hasGit, haveLocalChanges, SyncState } from '../src/inspect';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  exampleToken,
  gitDirectory,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addSomeFiles } from './utils';

describe('clone', () => {
  beforeEach(async () => {
    // remove dir's .git folder in this test suit, so we have a clean folder to clone
    await fs.remove(gitDirectory);
  });

  describe('with upstream', () => {
    test('equal to upstream after clone', async () => {
      await clone({
        dir,
        userInfo: { ...defaultGitInfo, accessToken: exampleToken },
        remoteUrl: upstreamDir,
      });
      expect(await hasGit(dir)).toBe(true);
      expect(await haveLocalChanges(dir)).toBe(false);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
      expect(await getDefaultBranchName(dir)).toBe(defaultGitInfo.branch);
    });

    test('equal to committed upstream', async () => {
      // modify upstream
      await addSomeFiles(upstreamDir);
      await addAndCommitUsingDugite(upstreamDir);

      await clone({
        dir,
        userInfo: { ...defaultGitInfo, accessToken: exampleToken },
        remoteUrl: upstreamDir,
      });
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
    });
  });
});
