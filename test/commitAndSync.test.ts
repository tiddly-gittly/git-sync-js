/* eslint-disable security/detect-non-literal-fs-filename */
import { getSyncState, SyncState } from '../src/inspect';
import { defaultGitInfo } from '../src/defaultGitInfo';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  exampleToken,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addBareUpstream, addSomeFiles } from './utils';
import { commitAndSync, ICommitAndSyncOptions } from '../src/commitAndSync';

describe('commitAndSync', () => {
  beforeEach(async () => {
    await addBareUpstream();
  });

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
});
