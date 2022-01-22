import { defaultGitInfo } from '../src/defaultGitInfo';

describe('defaultGitInfo', () => {
  test('default branch now should be main', () => {
    expect(defaultGitInfo.branch).toBe('main');
  });
});
