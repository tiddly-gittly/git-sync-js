/* eslint-disable security/detect-non-literal-fs-filename */
import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import { initGit } from '../src/initGit';
import { assumeSync, getDefaultBranchName, getSyncState, hasGit, haveLocalChanges, SyncState } from '../src/inspect';
import { commitFiles } from '../src/sync';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  exampleToken,
  gitDirectory,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addAnUpstream, addSomeFiles } from './utils';

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
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
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
    test('equal to upstream that using dugite add', async () => {
      await initGit({
        dir,
        syncImmediately: false,
        defaultGitInfo,
      });
      // nested describe > beforeEach execute first, so after we add upstream, the .git folder is deleted and recreated, we need to manually fetch here
      await GitProcess.exec(['fetch', defaultGitInfo.remote, defaultGitInfo.branch], dir);
      // basically same as other test suit
      const sharedCommitMessage = 'some commit message';

      // syncImmediately: false, so we don't have a remote yet
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
      await addAnUpstream();
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');

      await addSomeFiles();
      await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email, sharedCommitMessage);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('ahead');
      await expect(async () => {
        await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote);
      }).rejects.toThrowError(new AssumeSyncError('ahead'));

      // modify upstream
      await addSomeFiles(upstreamDir);
      await addAndCommitUsingDugite(upstreamDir, () => {}, sharedCommitMessage);
      // it is equal until we fetch the latest remote
      await GitProcess.exec(['fetch', defaultGitInfo.remote], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
    });

    test('syncImmediately to get equal state', async () => {
      await initGit({
        dir,
        syncImmediately: true,
        remoteUrl: upstreamDir,
        userInfo: { ...defaultGitInfo, accessToken: exampleToken },
      });
      // basically same as other test suit
      const sharedCommitMessage = 'some commit message';
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
      await addSomeFiles();
      await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email, sharedCommitMessage);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('ahead');
      await expect(async () => {
        await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote);
      }).rejects.toThrowError(new AssumeSyncError('ahead'));

      // modify upstream
      await addSomeFiles(upstreamDir);
      await addAndCommitUsingDugite(upstreamDir, () => {}, sharedCommitMessage);
      // it is equal until we fetch the latest remote
      await GitProcess.exec(['fetch', defaultGitInfo.remote], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
    });
  });
});
