/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs-extra';
import { GitProcess } from 'dugite';
import { getDefaultBranchName, getGitDirectory, getModifiedFileList, getRemoteUrl, hasGit } from '../src/inspect';
import { credentialOff, credentialOn, getGitUrlWithCredential } from '../src/credential';
import { defaultGitInfo } from '../src/defaultGitInfo';
// eslint-disable-next-line unicorn/prevent-abbreviations
import { dir, exampleRemoteUrl, exampleToken, gitDirectory, gitSyncRepoDirectoryGitDirectory } from './constants';

describe('getGitDirectory', () => {
  test('echo the git dir', async () => {
    expect(await getGitDirectory(dir)).toBe(gitDirectory);
  });

  test('hasGit is true', async () => {
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
  /** from https://stackoverflow.com/questions/39062595/how-can-i-create-a-png-blob-from-binary-data-in-a-typed-array */
  const exampleImageBuffer = Buffer.from(
    new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 8, 0, 0, 0, 8, 8, 2, 0, 0, 0, 75, 109, 41, 220, 0, 0, 0, 34, 73, 68, 65, 84, 8,
      215, 99, 120, 173, 168, 135, 21, 49, 0, 241, 255, 15, 90, 104, 8, 33, 129, 83, 7, 97, 163, 136, 214, 129, 93, 2, 43, 2, 0, 181, 31, 90, 179, 225, 252,
      176, 37, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]),
  );
  test('list multiple English file names in different ext name', async () => {
    const paths: [string, string] = [`${dir}/image.png`, `${dir}/test.json`];
    await fs.writeFile(paths[0], exampleImageBuffer);
    await fs.writeJSON(paths[1], { test: 'test' });
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
      expect(remoteUrl).toBe(getGitUrlWithCredential(exampleRemoteUrl, defaultGitInfo.gitUserName, exampleToken));
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
