import { exec } from 'dugite';
import fs from 'fs-extra';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { initGitWithBranch } from '../src/init';
import { commitFiles, fetchRemote, mergeUpstream, pushUpstream } from '../src/sync';
import { dir, dir2, exampleImageBuffer, exampleRemoteUrl, exampleToken, upstreamDir } from './constants';

export async function addSomeFiles<T extends [string, string]>(location = dir): Promise<T> {
  const paths: T = [`${location}/image.png`, `${location}/test.json`] as T;
  await fs.writeFile(paths[0], exampleImageBuffer);
  await fs.writeJSON(paths[1], { test: 'test' });
  return paths;
}

export async function addAnUpstream(repoPath = dir): Promise<void> {
  await exec(['remote', 'add', defaultGitInfo.remote, upstreamDir], repoPath);
  /**
   * Need to fetch the remote repo first, otherwise it will say:
   *
   * ```
   * % git rev-list --count --left-right origin/main...HEAD
      fatal: ambiguous argument 'origin/main...HEAD': unknown revision or path not in the working tree.
      Use '--' to separate paths from revisions, like this:
      'git <command> [<revision>...] -- [<file>...]'
    * ```
    */
  await fetchRemote(repoPath, defaultGitInfo.remote, defaultGitInfo.branch);
}

export async function addHTTPRemote(remoteName = defaultGitInfo.remote, remoteUrl = exampleRemoteUrl, directory = dir): Promise<void> {
  await exec(['remote', 'add', remoteName, remoteUrl], directory);
  await exec(['remote', 'set-url', remoteName, remoteUrl], directory);
}

export async function addAndCommitUsingDugite(
  location = dir,
  runBetween: () => void | Promise<void> = () => {},
  message = 'some commit message',
): Promise<void> {
  await exec(['add', '.'], location);
  await runBetween();
  await exec(['commit', '-m', message, `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], location);
}

export async function createAndSyncRepo2ToRemote(): Promise<void> {
  await fs.mkdirp(dir2);
  await initGitWithBranch(dir2, defaultGitInfo.branch, { initialCommit: false, bare: false, gitUserName: defaultGitInfo.gitUserName, email: defaultGitInfo.email });
  await addAnUpstream(dir2);
}

/**
 * Simulate another repo push to upstream, letting our local repo being behind.
 * Have to run `createAndSyncRepo2ToRemote()` before this.
 */
export async function anotherRepo2PushSomeFiles() {
  await fetchRemote(dir2, defaultGitInfo.remote);
  try {
    // this can fail if dir1 never push its initial commit to the remote, so remote is still bare and can't be pull. It is OK to ignore this error.
    await mergeUpstream(dir2, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
  } catch (error) {
    // Ignore merge failure when the upstream is still bare; expected during setup.
    void error;
  }
  await addSomeFiles(dir2);
  await commitFiles(dir2, defaultGitInfo.gitUserName, defaultGitInfo.email);
  await pushUpstream(dir2, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
}
