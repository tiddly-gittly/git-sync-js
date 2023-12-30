/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs-extra';
import path from 'path';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import { assumeSync, getModifiedFileList, getSyncState, SyncState } from '../src/inspect';
import { commitFiles, fetchRemote, mergeUpstream, pushUpstream } from '../src/sync';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  exampleToken,
} from './constants';
import { addAnUpstream, addSomeFiles, anotherRepo2PushSomeFiles, createAndSyncRepo2ToRemote } from './utils';

describe('commitFiles', () => {
  describe('with upstream', () => {
    beforeEach(async () => {
      await addAnUpstream();
    });

    test('not change sync state between upstream', async () => {
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
      await addSomeFiles();
      const sharedCommitMessage = 'some commit message';
      await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email, sharedCommitMessage);
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
      await expect(async () => {
        await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote);
      }).rejects.toThrow(new AssumeSyncError('noUpstreamOrBareUpstream'));
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
  beforeEach(async () => {
    await addAnUpstream();
  });
  test('equal to upstream after push', async () => {
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
    await addSomeFiles();
    await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email);

    await pushUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
  });
});

describe('mergeUpstream', () => {
  beforeEach(async () => {
    await Promise.all([
      addAnUpstream(),
      createAndSyncRepo2ToRemote(),
    ]);
  });

  test('equal to upstream after pull', async () => {
    // local repo with init commit is diverged with upstream with init commit
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
    await pushUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');

    await anotherRepo2PushSomeFiles();

    await fetchRemote(dir, defaultGitInfo.remote);
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('behind');
    await mergeUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
  });
});
