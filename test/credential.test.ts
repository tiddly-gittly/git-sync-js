import { credentialOn, getRemoteUrl, initGit } from '../src';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { dir, exampleToken, upstreamDir } from './constants';
import { addBareUpstream } from './utils';

describe('credential', () => {
  beforeEach(async () => {
    await addBareUpstream();
  });

  test('default branch now should be main', async () => {
    await initGit({
      dir,
      syncImmediately: false,
      defaultGitInfo,
    });
    const originalRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    await credentialOn(dir, upstreamDir, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    const remoteUrlAfterCredentialOn = await getRemoteUrl(dir, defaultGitInfo.remote);
    // DEBUG: console remoteUrl
    console.log(`remoteUrlAfterCredentialOn`, remoteUrlAfterCredentialOn);
    // DEBUG: console originalRemoteUrl
    console.log(`originalRemoteUrl`, originalRemoteUrl);
  });
});