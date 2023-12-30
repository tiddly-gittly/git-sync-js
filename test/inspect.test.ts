/* eslint-disable security/detect-non-literal-fs-filename */
import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import {
  assumeSync,
  getDefaultBranchName,
  getGitDirectory,
  getGitRepositoryState,
  getModifiedFileList,
  getRemoteName,
  getRemoteRepoName,
  getRemoteUrl,
  getSyncState,
  hasGit,
  haveLocalChanges,
  SyncState,
} from '../src/inspect';
import { fetchRemote, pushUpstream } from '../src/sync';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  exampleImageBuffer,
  exampleRemoteUrl,
  exampleRepoName,
  exampleToken,
  gitDirectory,
  gitSyncRepoDirectoryGitDirectory,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addAnUpstream, addSomeFiles, anotherRepo2PushSomeFiles, createAndSyncRepo2ToRemote } from './utils';

describe('getGitDirectory', () => {
  test('echo the git dir, hasGit is true', async () => {
    expect(await getGitDirectory(dir)).toBe(gitDirectory);
    expect(await hasGit(dir)).toBe(true);
  });

  describe('when no git', () => {
    beforeEach(async () => {
      await fs.remove(gitDirectory);
    });
    test("the git dir will be git-sync's dir", async () => {
      expect(await getGitDirectory(dir)).toBe(gitSyncRepoDirectoryGitDirectory);
    });

    test('hasGit is false when strictly no git', async () => {
      // will detect git-sync's repo git
      expect(await hasGit(dir, false)).toBe(true);
      // default is strictly check
      expect(await hasGit(dir)).toBe(false);
    });
  });
});

describe('getDefaultBranchName', () => {
  test('return undefined on a non git folder', async () => {
    const branch = await getDefaultBranchName(os.tmpdir());
    expect(branch).toBe(undefined);
  });

  test('return undefined on a not existed folder', async () => {
    const branch = await getDefaultBranchName(os.tmpdir() + '/not-existed');
    expect(branch).toBe(undefined);
  });

  test('it is main now due to BLM activities', async () => {
    const branch = await getDefaultBranchName(dir);
    expect(branch).toBe('main');
  });

  test("But if we are still using master because there wasn't a black man slavery history in Chinese", async () => {
    await GitProcess.exec(['branch', '-m', 'main', 'master'], dir);
    const branch = await getDefaultBranchName(dir);
    expect(branch).toBe('master');
  });
});

describe('getModifiedFileList', () => {
  test('list multiple English file names in different ext name', async () => {
    const paths = await addSomeFiles();
    const fileList = await getModifiedFileList(dir);
    expect(fileList).toStrictEqual([
      { filePath: path.normalize(paths[0]), fileRelativePath: paths[0].replace(`${dir}/`, ''), type: '??' },
      { filePath: path.normalize(paths[1]), fileRelativePath: paths[1].replace(`${dir}/`, ''), type: '??' },
    ]);
  });

  test('list multiple CJK file names', async () => {
    const paths: [string, string] = [path.join(dir, '试试啊.json'), path.join(dir, '一个破图片.png')];
    await fs.writeJSON(paths[0], { test: 'test' });
    await fs.writeFile(paths[1], exampleImageBuffer);
    const fileList = await getModifiedFileList(dir);
    expect(fileList).toStrictEqual([
      { filePath: paths[0], fileRelativePath: '试试啊.json', type: '??' },
      { filePath: paths[1], fileRelativePath: '一个破图片.png', type: '??' },
    ]);
  });
});

describe('getRemoteUrl', () => {
  test("New repo don't have remote", async () => {
    const remoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(remoteUrl).toBe('');
  });

  test('have remote after add upstream', async () => {
    await addAnUpstream();
    const remoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(path.normalize(remoteUrl)).toBe(upstreamDir);
  });
});

describe('getRemoteRepoName', () => {
  test('Get github repo name', () => {
    const repoName = getRemoteRepoName(exampleRemoteUrl);
    expect(repoName).toBe(exampleRepoName);
  });
  test('Get gitlab repo name', () => {
    const repoName = getRemoteRepoName('https://code.byted.org/ad/bytedance-secret-notes');
    expect(repoName).toBe('ad/bytedance-secret-notes');
  });

  test('Return undefined from malformed url', () => {
    const repoName = getRemoteRepoName('https://asdfasdf-asdfadsf');
    expect(repoName).toBe(undefined);
  });

  test('Return last slash when unknown', () => {
    const repoName = getRemoteRepoName('https://asdfasdf/asdfadsf');
    expect(repoName).toBe('asdfadsf');
  });

  test('Throw when not a url', () => {
    expect(() => getRemoteRepoName('sdfasdf/asdfadsf')).toThrowError(new TypeError('Invalid URL'));
  });
});

describe('getRemoteName', () => {
  test('Get default origin when no config found', async () => {
    const remoteName = await getRemoteName(dir, defaultGitInfo.branch);
    expect(remoteName).toBe(defaultGitInfo.remote);
  });
});

describe('haveLocalChanges', () => {
  test('When there are newly added files', async () => {
    expect(await haveLocalChanges(dir)).toBe(false);
  });

  describe('we touch some files', () => {
    beforeEach(async () => {
      await addSomeFiles();
    });
    test('When there are newly added files', async () => {
      expect(await haveLocalChanges(dir)).toBe(true);
    });

    test('No change after commit', async () => {
      await addAndCommitUsingDugite(dir, async () => {
        expect(await haveLocalChanges(dir)).toBe(true);
      });
      expect(await haveLocalChanges(dir)).toBe(false);
    });
  });
});

describe('getSyncState and getGitRepositoryState', () => {
  test('It should have no upstream by default', async () => {
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
  });

  describe('Add a repo as the upstream', () => {
    beforeEach(async () => {
      await addAnUpstream();
    });

    test('have a mock upstream', async () => {
      expect(path.normalize(await getRemoteUrl(dir, defaultGitInfo.remote))).toBe(upstreamDir);
    });
    test('upstream is bare', async () => {
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
      await expect(async () => await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote)).rejects.toThrow(new AssumeSyncError('noUpstreamOrBareUpstream'));
    });
    test('still bare there are newly added files', async () => {
      await addSomeFiles();
      expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
    });

    describe('push to make it equal', () => {
      beforeEach(async () => {
        // make it equal
        await pushUpstream(dir, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
      });
      test('ahead after commit', async () => {
        expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');

        await addSomeFiles();
        await addAndCommitUsingDugite();
        expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('ahead');
        await expect(async () => {
          await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote);
        }).rejects.toThrow(new AssumeSyncError('ahead'));
      });

      test('behind after repo2 modify the remote', async () => {
        // repo2 modify the remote, make us behind
        await createAndSyncRepo2ToRemote();
        await anotherRepo2PushSomeFiles();
        // it is equal until we fetch the latest remote
        await fetchRemote(dir, defaultGitInfo.remote);
        expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('behind');
        await expect(async () => {
          await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote);
        }).rejects.toThrow(new AssumeSyncError('behind'));
      });

      test('diverged after modify both remote and local', async () => {
        // repo2 modify the remote, make us behind
        await createAndSyncRepo2ToRemote();
        await anotherRepo2PushSomeFiles();
        expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');

        // if use same file and same commit message, it will be equal than diverged in the end (?), not, it will just be diverged, at least tested in windows.
        await addSomeFiles(dir);
        await addAndCommitUsingDugite(
          dir,
          async () => {
            expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
          },
          'some different commit message',
        );
        // not latest remote data, so we thought we are ahead
        expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('ahead');

        // it is equal until we fetch the latest remote
        await fetchRemote(dir, defaultGitInfo.remote);
        expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('diverged');
        await expect(async () => {
          await assumeSync(dir, defaultGitInfo.branch, defaultGitInfo.remote);
        }).rejects.toThrow(new AssumeSyncError('diverged'));
      });
    });
  });
});

describe('getGitRepositoryState', () => {
  test('normal git state', async () => {
    expect(await getGitRepositoryState(dir)).toBe('');

    await addSomeFiles(dir);
    await addAndCommitUsingDugite();
    expect(await getGitRepositoryState(dir)).toBe('');
  });

  test("'when no git, it say NOGIT", async () => {
    await fs.remove(gitDirectory);
    expect(await getGitRepositoryState(dir)).toBe('NOGIT');
  });

  test('dirty when there are some files', async () => {
    await addSomeFiles(dir);
    expect(await getGitRepositoryState(dir)).toBe('|DIRTY');
  });
});
