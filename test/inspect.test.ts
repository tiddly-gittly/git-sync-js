/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs-extra';
import { GitProcess } from 'dugite';
import {
  assumeSync,
  getDefaultBranchName,
  getGitDirectory,
  getGitRepositoryState,
  getModifiedFileList,
  getRemoteRepoName,
  getRemoteUrl,
  getSyncState,
  hasGit,
  haveLocalChanges,
  SyncState,
} from '../src/inspect';
import { credentialOff, credentialOn, getGitUrlWithCredential, getGitUrlWithCredentialAndSuffix } from '../src/credential';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
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
import { addSomeFiles } from './utils';

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
      { filePath: paths[0], fileRelativePath: paths[0].replace(`${dir}/`, ''), type: '??' },
      { filePath: paths[1], fileRelativePath: paths[1].replace(`${dir}/`, ''), type: '??' },
    ]);
  });

  test('list multiple CJK file names', async () => {
    const paths: [string, string] = [`${dir}/试试啊.json`, `${dir}/一个破图片.png`];
    await fs.writeJSON(paths[0], { test: 'test' });
    await fs.writeFile(paths[1], exampleImageBuffer);
    const fileList = await getModifiedFileList(dir);
    expect(fileList).toStrictEqual([
      { filePath: paths[0], fileRelativePath: paths[0].replace(`${dir}/`, ''), type: '??' },
      { filePath: paths[1], fileRelativePath: paths[1].replace(`${dir}/`, ''), type: '??' },
    ]);
  });
});

describe('getRemoteUrl', () => {
  test("New repo don't have remote", async () => {
    const remoteUrl = await getRemoteUrl(dir);
    expect(remoteUrl).toBe('');
  });

  describe('credential can be added to the remote', () => {
    test('it has remote with token after calling credentialOn', async () => {
      await credentialOn(dir, exampleRemoteUrl, defaultGitInfo.gitUserName, exampleToken);
      const remoteUrl = await getRemoteUrl(dir);
      expect(remoteUrl.length).toBeGreaterThan(0);
      expect(remoteUrl).toBe(getGitUrlWithCredentialAndSuffix(getGitUrlWithCredential(exampleRemoteUrl, defaultGitInfo.gitUserName, exampleToken)));
      // github use https://${username}:${accessToken}@github.com/ format
      expect(remoteUrl.includes('@')).toBe(true);
      expect(remoteUrl.includes(exampleToken)).toBe(true);
      expect(remoteUrl.endsWith('.git')).toBe(true);
    });

    test('it has a credential-free remote with .git suffix after calling credentialOff', async () => {
      await credentialOn(dir, exampleRemoteUrl, defaultGitInfo.gitUserName, exampleToken);
      await credentialOff(dir);
      const remoteUrl = await getRemoteUrl(dir);
      expect(remoteUrl.length).toBeGreaterThan(0);
      expect(remoteUrl).toBe(exampleRemoteUrl);
      expect(remoteUrl.includes('@')).toBe(false);
      expect(remoteUrl.includes(exampleToken)).toBe(false);
      expect(remoteUrl.endsWith('.git')).toBe(false);
    });
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
      await GitProcess.exec(['add', '.'], dir);
      expect(await haveLocalChanges(dir)).toBe(true);
      await GitProcess.exec(['commit', '-m', 'some commit message', `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], dir);
      expect(await haveLocalChanges(dir)).toBe(false);
    });
  });
});

describe('getSyncState and getGitRepositoryState', () => {
  test('It should have no upstream by default', async () => {
    expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('noUpstream');
  });

  describe('Add a repo as the upstream', () => {
    beforeEach(async () => {
      await GitProcess.exec(['remote', 'add', 'origin', upstreamDir], dir);
      /**
       * Need to fetch the remote repo first, otherwise it will say:
       * 
       * ```
       * % git rev-list --count --left-right origin/main...HEAD        
          fatal: ambiguous argument 'origin/main...HEAD': unknown revision or path not in the working tree.
          Use '--' to separate paths from revisions, like this:
          'git <command> [<revision>...] -- [<file>...]'
       * ```
       */
      await GitProcess.exec(['fetch', 'origin', defaultGitInfo.branch], dir);
    });

    test('have a mock upstream', async () => {
      expect(await getRemoteUrl(dir)).toBe(upstreamDir);
    });
    test('equal to upstream', async () => {
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
      expect(await assumeSync(dir, defaultGitInfo.branch)).toBe(undefined);
    });
    test('still equal there are newly added files', async () => {
      await addSomeFiles();
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
    });

    test('ahead after commit', async () => {
      await addSomeFiles();
      await GitProcess.exec(['add', '.'], dir);
      await GitProcess.exec(['commit', '-m', 'some commit message', `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('ahead');
      await expect(async () => await assumeSync(dir, defaultGitInfo.branch)).rejects.toThrowError(new AssumeSyncError());
    });

    test('behind after modify the remote', async () => {
      await addSomeFiles(upstreamDir);
      await GitProcess.exec(['add', '.'], upstreamDir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
      await GitProcess.exec(['commit', '-m', 'some commit message', `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], upstreamDir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
      // it is equal until we fetch the latest remote
      await GitProcess.exec(['fetch', 'origin'], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('behind');
      await expect(async () => await assumeSync(dir, defaultGitInfo.branch)).rejects.toThrowError(new AssumeSyncError());
    });

    test('diverged after modify both remote and local', async () => {
      await addSomeFiles(upstreamDir);
      await GitProcess.exec(['add', '.'], upstreamDir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
      await GitProcess.exec(['commit', '-m', 'some commit message', `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], upstreamDir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');

      await addSomeFiles(dir);
      await GitProcess.exec(['add', '.'], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('equal');
      // if use same file and same commit message, it will be equal than diverged in the end
      await GitProcess.exec(['commit', '-m', 'some different commit message', `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], dir);
      // not latest remote data, so we thought we are ahead
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('ahead');

      // it is equal until we fetch the latest remote
      await GitProcess.exec(['fetch', 'origin'], dir);
      expect(await getSyncState(dir, defaultGitInfo.branch)).toBe<SyncState>('diverged');
      await expect(async () => await assumeSync(dir, defaultGitInfo.branch)).rejects.toThrowError(new AssumeSyncError());
    });
  });
});

describe('getGitRepositoryState', () => {
  test('normal git state', async () => {
    expect(await getGitRepositoryState(dir)).toBe('');

    await addSomeFiles(dir);
    await GitProcess.exec(['add', '.'], dir);
    await GitProcess.exec(['commit', '-m', 'some commit message', `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], dir);
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
