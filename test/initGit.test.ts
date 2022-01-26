/* eslint-disable security/detect-non-literal-fs-filename */
import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import { assumeSync, getDefaultBranchName, getSyncState, hasGit, haveLocalChanges, SyncState } from '../src/inspect';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  gitDirectory,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addAnUpstream, addSomeFiles } from './utils';
import { commitFiles } from '../src/sync';
import { initGit } from '../src/initGit';

describe('initGit', () => {
  beforeEach(async () => {
    // remove dir's .git folder in this test suit, so we have a clean folder to init
    await fs.remove(gitDirectory);
  });

  const testBranchName = 'test-branch';
  test('Have a valid local repo after init', async () => {
    await initGit({ dir, syncImmediately: false, userInfo: { ...defaultGitInfo, branch: testBranchName } });
    expect(await hasGit(dir)).toBe(true);
    expect(await haveLocalChanges(dir)).toBe(false);
    expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('noUpstream');
    expect(await getDefaultBranchName(dir)).toBe(testBranchName);
  });

  test('Fallback to default info', async () => {
    await initGit({ dir, syncImmediately: false, defaultGitInfo: { ...defaultGitInfo, branch: testBranchName } });
    expect(await getDefaultBranchName(dir)).toBe(testBranchName);
  });

  test("Don't use fallback if have provided info", async () => {
    await initGit({
      dir,
      syncImmediately: false,
      userInfo: { ...defaultGitInfo, branch: testBranchName },
      defaultGitInfo: { ...defaultGitInfo, branch: testBranchName + '-bad' },
    });
    expect(await getDefaultBranchName(dir)).toBe(testBranchName);
  });

  describe('with upstream', () => {
    beforeEach(async () => {
      await addAnUpstream();
    });

    test('equal to upstream that using dugite add', async () => {
      await initGit({
        dir,
        syncImmediately: false,
        defaultGitInfo,
      });
      // nested describe > beforeEach execute first, so after we add upstream, the .git folder is deleted and recreated, we need to manually fetch here
      await GitProcess.exec(['fetch', 'origin', defaultGitInfo.branch], dir);
      // basically same as other test suit
      const sharedCommitMessage = 'some commit message';
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
      await addSomeFiles();
      await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email, sharedCommitMessage);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('ahead');
      await expect(async () => await assumeSync(dir, defaultGitInfo.branch)).rejects.toThrowError(new AssumeSyncError());

      // modify upstream
      await addSomeFiles(upstreamDir);
      await addAndCommitUsingDugite(upstreamDir, () => {}, sharedCommitMessage);
      // it is equal until we fetch the latest remote
      await GitProcess.exec(['fetch', 'origin'], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
    });
  });
});
