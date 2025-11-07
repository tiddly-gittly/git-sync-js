import { omit } from 'lodash';
import { exec } from 'dugite';
import { commitAndSync, ICommitAndSyncOptions } from '../src/commitAndSync';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { GitPullPushError } from '../src/errors';
import { getRemoteUrl, getSyncState, SyncState } from '../src/inspect';
import { creatorGitInfo, dir, exampleToken, upstreamDir } from './constants';
import { addSomeFiles } from './utils';
import { toGitStringResult } from '../src/utils';

describe('commitAndSync', () => {
  const getCommitAndSyncOptions = (): ICommitAndSyncOptions => ({
    dir,
    remoteUrl: upstreamDir,
    userInfo: { ...defaultGitInfo, accessToken: exampleToken },
  });

  test('equal to upstream that been commitAndSync to', async () => {
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
    await addSomeFiles();
    await commitAndSync(getCommitAndSyncOptions());
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
  });
  test('restore Github credential after failed', async () => {
    // can't push to github during test, so we use a fake token and only test failed situation
    const creatorRepoUrl = `https://github.com/${creatorGitInfo.gitUserName}/wiki`;
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('noUpstreamOrBareUpstream');
    await addSomeFiles();
    const options = {
      dir,
      remoteUrl: creatorRepoUrl,
      userInfo: { ...creatorGitInfo, branch: 'main' },
    };
    await expect(async () => {
      await commitAndSync(options);
    }).rejects.toThrow(
      new GitPullPushError(
        // print the same error message as Error...
        { ...omit(options, ['remoteUrl', 'userInfo']), branch: 'main', remote: 'origin', userInfo: options.userInfo },
        `remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/linonetwo/wiki/'
`,
      ),
    );
    const restoredRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(restoredRemoteUrl).toBe(creatorRepoUrl);
  });

  test('sets committer identity correctly', async () => {
    // Add some files and commit
    await addSomeFiles();
    await commitAndSync(getCommitAndSyncOptions());
    
    // Verify that both author and committer are set correctly
    const logResult = toGitStringResult(
      await exec(['log', '--format=%an|%ae|%cn|%ce', '-1'], dir),
    );
    
    expect(logResult.exitCode).toBe(0);
    const [authorName, authorEmail, committerName, committerEmail] = logResult.stdout.trim().split('|');
    
    // Both author and committer should be set to the same user info
    expect(authorName).toBe(defaultGitInfo.gitUserName);
    expect(authorEmail).toBe(defaultGitInfo.email);
    expect(committerName).toBe(defaultGitInfo.gitUserName);
    expect(committerEmail).toBe(defaultGitInfo.email);
  });
});
