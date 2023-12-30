import { GitProcess } from 'dugite';
import { trim } from 'lodash';
import { getRemoteUrl } from './inspect';

// TODO: support folderLocation as rawUrl like `/Users/linonetwo/Desktop/repo/git-sync-js/test/mockUpstreamRepo/credential` for test, or gitlab url.
export const getGitUrlWithCredential = (rawUrl: string, username: string, accessToken: string): string =>
  trim(rawUrl.replaceAll('\n', '').replace('https://github.com/', `https://${username}:${accessToken}@github.com/`));
const getGitUrlWithOutCredential = (urlWithCredential: string): string => trim(urlWithCredential.replace(/.+@/, 'https://'));

/**
 *  Add remote with credential
 * @param {string} directory
 * @param {string} remoteUrl
 * @param {{ login: string, email: string, accessToken: string }} userInfo
 */
export async function credentialOn(directory: string, remoteUrl: string, userName: string, accessToken: string, remoteName: string): Promise<void> {
  const gitUrlWithCredential = getGitUrlWithCredential(remoteUrl, userName, accessToken);
  await GitProcess.exec(['remote', 'add', remoteName, gitUrlWithCredential], directory);
  await GitProcess.exec(['remote', 'set-url', remoteName, gitUrlWithCredential], directory);
}
/**
 *  Add remote without credential
 * @param {string} directory
 * @param {string} githubRepoUrl
 * @param {{ login: string, email: string, accessToken: string }} userInfo
 */
export async function credentialOff(directory: string, remoteName: string, remoteUrl?: string): Promise<void> {
  const githubRepoUrl = remoteUrl ?? (await getRemoteUrl(directory, remoteName));
  const gitUrlWithOutCredential = getGitUrlWithOutCredential(githubRepoUrl);
  await GitProcess.exec(['remote', 'set-url', remoteName, gitUrlWithOutCredential], directory);
}
