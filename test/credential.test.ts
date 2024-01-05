import { credentialOff, credentialOn, getGitHubUrlWithCredential, getRemoteUrl } from '../src';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { getGitUrlWithGitSuffix, getGitUrlWithOutGitSuffix } from '../src/utils';
import { creatorGitInfo, dir, exampleRemoteUrl, exampleToken } from './constants';
import { addHTTPRemote } from './utils';

describe('credential', () => {
  beforeEach(async () => {
    await addHTTPRemote();
  });

  test('it has remote with token after calling credentialOn', async () => {
    await credentialOn(dir, exampleRemoteUrl, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    const remoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    // make sure we are working on a https remote, our method only handle this case
    expect(remoteUrl).toStartWith('https://');
    expect(remoteUrl.length).toBeGreaterThan(0);
    expect(remoteUrl).toBe(getGitHubUrlWithCredential(exampleRemoteUrl, defaultGitInfo.gitUserName, exampleToken));
    // github use https://${username}:${accessToken}@github.com/ format
    expect(remoteUrl.includes('@')).toBe(true);
    expect(remoteUrl.includes(exampleToken)).toBe(true);
    // we want user add .git himself before credentialOn
    expect(remoteUrl.endsWith('.git')).toBe(false);
  });

  test('it has a credential-free remote with .git suffix after calling credentialOff', async () => {
    await credentialOn(dir, exampleRemoteUrl, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    await credentialOff(dir, defaultGitInfo.remote);
    const remoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(remoteUrl.length).toBeGreaterThan(0);
    expect(remoteUrl).toBe(exampleRemoteUrl);
    expect(remoteUrl.includes('@')).toBe(false);
    expect(remoteUrl.includes(exampleToken)).toBe(false);
    expect(remoteUrl.endsWith('.git')).toBe(false);
  });

  test('it keeps .git suffix, letting user add and remove it', async () => {
    const exampleRemoteUrlWithSuffix = getGitUrlWithGitSuffix(exampleRemoteUrl);
    expect(exampleRemoteUrlWithSuffix.endsWith('.git')).toBe(true);
    await credentialOn(dir, exampleRemoteUrlWithSuffix, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    const newRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(newRemoteUrl.endsWith('.git')).toBe(true);
    await credentialOff(dir, defaultGitInfo.remote);
    const restoredRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(restoredRemoteUrl.endsWith('.git')).toBe(true);
    const remoteUrlWithoutSuffix = getGitUrlWithOutGitSuffix(restoredRemoteUrl);
    expect(remoteUrlWithoutSuffix.endsWith('.git')).toBe(false);
  });

  test('it remove token after off', async () => {
    const originalRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    await credentialOn(dir, originalRemoteUrl, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    const newRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(newRemoteUrl.includes(exampleToken)).toBe(true);
    await credentialOff(dir, defaultGitInfo.remote);
    const restoredRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(restoredRemoteUrl).toBe(originalRemoteUrl);
    expect(restoredRemoteUrl.includes(exampleToken)).toBe(false);
  });

  test('it remove Github token after off (specific case of creator)', async () => {
    const creatorRepoUrl = `https://github.com/${creatorGitInfo.gitUserName}/wiki`;
    const creatorRepoUrlWithToken = `https://${creatorGitInfo.gitUserName}:${creatorGitInfo.accessToken}@github.com/${creatorGitInfo.gitUserName}/wiki`;
    await credentialOn(dir, creatorRepoUrl, creatorGitInfo.gitUserName, creatorGitInfo.accessToken, defaultGitInfo.remote);
    const newRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(newRemoteUrl.includes(creatorGitInfo.accessToken)).toBe(true);
    expect(newRemoteUrl).toBe(creatorRepoUrlWithToken);
    await credentialOff(dir, defaultGitInfo.remote);
    const restoredRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(restoredRemoteUrl).toBe(creatorRepoUrl);
    expect(restoredRemoteUrl.includes(exampleToken)).toBe(false);
  });

  test('it remove Github token from url with token (specific case of creator)', async () => {
    const creatorRepoUrl = `https://github.com/${creatorGitInfo.gitUserName}/wiki`;
    const creatorRepoUrlWithToken = `https://${creatorGitInfo.gitUserName}:${creatorGitInfo.accessToken}@github.com/${creatorGitInfo.gitUserName}/wiki`;
    // sometimes, original url has token (forget to remove) due to bugs in previous versions.
    await credentialOn(dir, creatorRepoUrlWithToken, creatorGitInfo.gitUserName, creatorGitInfo.accessToken, defaultGitInfo.remote);
    const newRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(newRemoteUrl.includes(creatorGitInfo.accessToken)).toBe(true);
    expect(newRemoteUrl).toBe(creatorRepoUrlWithToken);
    await credentialOff(dir, defaultGitInfo.remote);
    const restoredRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(restoredRemoteUrl).toBe(creatorRepoUrl);
    expect(restoredRemoteUrl.includes(exampleToken)).toBe(false);
  });

  test('methods are idempotent', async () => {
    const originalRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    await credentialOn(dir, originalRemoteUrl, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    const newRemoteUrl1 = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(newRemoteUrl1.includes(exampleToken)).toBe(true);
    await credentialOn(dir, newRemoteUrl1, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    await credentialOn(dir, newRemoteUrl1, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    await credentialOn(dir, newRemoteUrl1, defaultGitInfo.gitUserName, exampleToken, defaultGitInfo.remote);
    const newRemoteUrl2 = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(newRemoteUrl2.includes(exampleToken)).toBe(true);
    expect(newRemoteUrl2).toBe(newRemoteUrl1);
    await credentialOff(dir, defaultGitInfo.remote);
    await credentialOff(dir, defaultGitInfo.remote);
    await credentialOff(dir, defaultGitInfo.remote);
    const restoredRemoteUrl = await getRemoteUrl(dir, defaultGitInfo.remote);
    expect(restoredRemoteUrl).toBe(originalRemoteUrl);
    expect(restoredRemoteUrl.includes(exampleToken)).toBe(false);
  });
});
