import { trim } from 'lodash';
import git from 'isomorphic-git';
import fs from 'fs-extra';
import { getRemoteUrl } from './inspect';
import { SyncParameterMissingError } from './errors';

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
  const remoteName = 'origin';
  try {
    await git.deleteRemote({ fs, dir, remote: remoteName });
  } catch {}
  await git.addRemote({
    fs,
    dir,
    remote: remoteName,
    url: gitUrlWithCredential,
  });
}
/**
 *  Add remote without credential
 * @param {string} dir
 * @param {string} githubRepoUrl
 * @param {{ login: string, email: string, accessToken: string }} userInfo
 */
export async function credentialOff(dir: string): Promise<void> {
  const remoteUrl = await getRemoteUrl(dir);
  const remoteName = 'origin';
  if (remoteUrl === undefined || remoteUrl.length === 0) {
    throw new SyncParameterMissingError('remoteUrl');
  }
  const gitUrlWithOutCredential = getGitUrlWithOutCredential(remoteUrl);
  try {
    await git.deleteRemote({ fs, dir, remote: remoteName });
  } catch {}
  await git.addRemote({
    fs,
    dir,
    remote: remoteName,
    url: gitUrlWithOutCredential,
  });
}
