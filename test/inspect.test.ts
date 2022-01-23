/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs-extra';
import { getDefaultBranchName, getGitDirectory, getModifiedFileList, hasGit } from '../src/inspect';
// eslint-disable-next-line unicorn/prevent-abbreviations
import { dir, gitDirectory, gitSyncRepoDirectoryGitDirectory } from './constants';

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
});

describe.only('getModifiedFileList', () => {
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
