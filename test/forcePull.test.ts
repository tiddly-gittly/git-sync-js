import { commitFiles, fetchRemote, forcePull, getSyncState, IForcePullOptions, SyncState } from '../src';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { dir, exampleToken, upstreamDir } from './constants';
import { addAnUpstream, addSomeFiles, anotherRepo2PushSomeFiles, createAndSyncRepo2ToRemote } from './utils';

describe('forcePull', () => {
  beforeEach(async () => {
    await addAnUpstream();
    // repo2 modify the remote, make us behind
    await createAndSyncRepo2ToRemote();
    await anotherRepo2PushSomeFiles();
  });

  const getForcePullOptions = (): IForcePullOptions => ({
    dir,
    remoteUrl: upstreamDir,
    userInfo: { ...defaultGitInfo, accessToken: exampleToken },
  });

  test('added files will be diverged', async () => {
    await addSomeFiles();
    await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email);
    await fetchRemote(dir, defaultGitInfo.remote, defaultGitInfo.branch);

    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('diverged');
  });
  test('added files discarded after pull and being equal', async () => {
    await addSomeFiles();
    await commitFiles(dir, defaultGitInfo.gitUserName, defaultGitInfo.email);
    // force pull without fetch
    await forcePull(getForcePullOptions());
    expect(await getSyncState(dir, defaultGitInfo.branch, defaultGitInfo.remote)).toBe<SyncState>('equal');
  });
});
