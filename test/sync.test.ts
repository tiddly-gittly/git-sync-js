/* eslint-disable security/detect-non-literal-fs-filename */
import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import path from 'path';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import { assumeSync, getModifiedFileList, getSyncState, SyncState } from '../src/inspect';
import { commitFiles, mergeUpstream, pushUpstream } from '../src/sync';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  exampleToken,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addAnUpstream, addBareUpstream, addSomeFiles } from './utils';

describe('commitFiles', () => {
  describe('with upstream', () => {
    beforeEach(async () => {
      await addAnUpstream();
    });

    test('equal to upstream that using dugite add', async () => {
      const sharedCommitMessage = 'some commit message';
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
      await addSomeFiles();
      await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email, sharedCommitMessage);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('ahead');
      await expect(async () => {
        await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote);
      }).rejects.toThrow(new AssumeSyncError('ahead'));

      // modify upstream
      await addSomeFiles(upstreamDir);
      await addAndCommitUsingDugite(upstreamDir, () => {}, sharedCommitMessage);
      // local repo think it is ahead until we fetch the latest remote (it doesn't know remote has been updated)
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('ahead');
      await GitProcess.exec(['fetch', defaultGitInfo.remote], dir);
      // although we add the same file, but the commit is different in git's view, so it is diverged (`1 1` means 1 commit in local, 1 commit in remote)
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('diverged');
    });
  });

  test('ignore provided file list', async () => {
    await addSomeFiles();
    const ignoredFileName = '.useless';
    const ignoredFilePath = path.join(dir, ignoredFileName);
    await fs.writeFile(ignoredFilePath, 'useless');
    await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email, undefined, [ignoredFileName]);
    const fileList = await getModifiedFileList(dir);
    expect(fileList).toStrictEqual([{ filePath: ignoredFilePath, fileRelativePath: ignoredFileName, type: '??' }]);
  });
});

describe('pushUpstream', () => {
  describe('with upstream', () => {
    beforeEach(async () => {
      await addBareUpstream();
    });

    test('equal to upstream after push', async () => {
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
      await addSomeFiles();
      await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email);

      await pushUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
    });
  });
});

describe('mergeUpstream', () => {
  describe('with upstream', () => {
    beforeEach(async () => {
      await addAnUpstream();
    });

    test('equal to upstream after pull', async () => {
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
      await addSomeFiles(upstreamDir);
      await commitFiles(upstreamDir, defaultGitInfo.gitUserName, defaultGitInfo.email);
      await GitProcess.exec(['fetch', defaultGitInfo.remote], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('behind');
      await mergeUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
    });
  });
});
