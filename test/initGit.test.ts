/* eslint-disable security/detect-non-literal-fs-filename */
import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import { assumeSync, getDefaultBranchName, getSyncState, hasGit, haveLocalChanges, SyncState } from '../src/inspect';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addAnUpstream, addSomeFiles } from './utils';
import { commitFiles } from '../src/sync';
import { initGit } from '../src/initGit';

describe.skip('initGit', () => {
  beforeEach(async () => {
    // remove dir in this test suit, so we have a clean slate to init
    await fs.remove(dir);
  });

  const testBranchName = 'test-branch';
  test('Have a valid local repo after init', async () => {
    await initGit({ dir, syncImmediately: false, userInfo: { ...defaultGitInfo, branch: testBranchName } });
    expect(await hasGit(dir)).toBe(true);
    expect(await haveLocalChanges(dir)).toBe(false);
    expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('noUpstream');
    await expect(await getDefaultBranchName(dir)).resolves.toBe(testBranchName);
  });

  test('Fallback to default info', async () => {
    await initGit({ dir, syncImmediately: false, defaultGitInfo: { ...defaultGitInfo, branch: testBranchName } });
    await expect(await getDefaultBranchName(dir)).resolves.toBe(testBranchName);
  });

  test("Don't use fallback if have provided info", async () => {
    await initGit({
      dir,
      syncImmediately: false,
      userInfo: { ...defaultGitInfo, branch: testBranchName },
      defaultGitInfo: { ...defaultGitInfo, branch: testBranchName + '-bad' },
    });
    await expect(await getDefaultBranchName(dir)).resolves.toBe(testBranchName);
  });

  describe.skip('with upstream', () => {
    beforeEach(async () => {
      await addAnUpstream();
    });

    test('equal to upstream that using dugite add', async () => {
      await initGit({
        dir,
        syncImmediately: false,
        defaultGitInfo,
      });
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
