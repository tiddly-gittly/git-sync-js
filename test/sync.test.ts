/* eslint-disable security/detect-non-literal-fs-filename */
import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import path from 'path';
import { assumeSync, getModifiedFileList, getSyncState, SyncState } from '../src/inspect';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addAnUpstream, addSomeFiles } from './utils';
import { commitFiles, mergeUpstream, pushUpstream } from '../src/sync';

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
      await expect(async () => await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote)).rejects.toThrowError(new AssumeSyncError('ahead'));

      // modify upstream
      await addSomeFiles(upstreamDir);
      await addAndCommitUsingDugite(upstreamDir, () => {}, sharedCommitMessage);
      // it is equal until we fetch the latest remote
      await GitProcess.exec(['fetch', defaultGitInfo.remote], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
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
      await addAnUpstream();
    });

    test('equal to upstream after push', async () => {
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
      await addSomeFiles();
      await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('ahead');

      await pushUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote);
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
      await mergeUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
    });
  });
});
