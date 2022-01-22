import fs from 'fs-extra';
import { getDefaultBranchName, getGitDirectory, hasGit } from '../src/inspect';
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
    beforeAll(async () => {
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

describe.only('getDefaultBranchName', () => {
  test('it is main now due to BLM activities', async () => {
    const branch = await getDefaultBranchName(dir);
    expect(branch).toBe('main');
  });
});
