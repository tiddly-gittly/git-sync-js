import { trim } from 'lodash';
import { GitProcess } from 'dugite';
import { getRemoteUrl } from './inspect';

const getGitUrlWithCredential = (rawUrl: string, username: string, accessToken: string): string =>
  trim(`${rawUrl}.git`.replace(/\n/g, '').replace('https://github.com/', `https://${username}:${accessToken}@github.com/`));
const getGitUrlWithOutCredential = (urlWithCredential: string): string => trim(urlWithCredential.replace(/.+@/, 'https://'));

/**
 *  Add remote with credential
 * @param {string} dir
 * @param {string} remoteUrl
 * @param {{ login: string, email: string, accessToken: string }} userInfo
 */
export async function credentialOn(dir: string, remoteUrl: string, userName: string, accessToken: string): Promise<void> {
  const gitUrlWithCredential = getGitUrlWithCredential(remoteUrl, userName, accessToken);
  await GitProcess.exec(['remote', 'add', 'origin', gitUrlWithCredential], dir);
  await GitProcess.exec(['remote', 'set-url', 'origin', gitUrlWithCredential], dir);
}
/**
 *  Add remote without credential
 * @param {string} dir
 * @param {string} githubRepoUrl
 * @param {{ login: string, email: string, accessToken: string }} userInfo
 */
export async function credentialOff(dir: string): Promise<void> {
  const githubRepoUrl = await getRemoteUrl(dir);
  const gitUrlWithOutCredential = getGitUrlWithOutCredential(githubRepoUrl);
  await GitProcess.exec(['remote', 'set-url', 'origin', gitUrlWithOutCredential], dir);
}
