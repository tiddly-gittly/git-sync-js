import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { initGitWithBranch } from '../src/init';
// eslint-disable-next-line unicorn/prevent-abbreviations
import { commitFiles, mergeUpstream, pushUpstream } from '../src/sync';
import { dir, dir2, exampleImageBuffer, exampleRemoteUrl, exampleToken, upstreamDir } from './constants';

export async function addSomeFiles<T extends [string, string]>(location = dir): Promise<T> {
  const paths: T = [`${location}/image.png`, `${location}/test.json`] as T;
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.writeFile(paths[0], exampleImageBuffer);
  await fs.writeJSON(paths[1], { test: 'test' });
  return paths;
}

export async function addAnUpstream(repoPath = dir): Promise<void> {
  await GitProcess.exec(['remote', 'add', defaultGitInfo.remote, upstreamDir], repoPath);
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
  await GitProcess.exec(['fetch', defaultGitInfo.remote, defaultGitInfo.branch], repoPath);
}

export async function addHTTPRemote(remoteName = defaultGitInfo.remote, remoteUrl = exampleRemoteUrl, directory = dir): Promise<void> {
  await GitProcess.exec(['remote', 'add', remoteName, remoteUrl], directory);
  await GitProcess.exec(['remote', 'set-url', remoteName, remoteUrl], directory);
}

export async function addAndCommitUsingDugite(
  location = dir,
  runBetween: () => unknown | Promise<unknown> = () => {},
  message = 'some commit message',
): Promise<void> {
  await GitProcess.exec(['add', '.'], location);
  await runBetween();
  await GitProcess.exec(['commit', '-m', message, `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], location);
}

export async function createAndSyncRepo2ToRemote(): Promise<void> {
  await fs.mkdirp(dir2);
  await initGitWithBranch(dir2, defaultGitInfo.branch, { initialCommit: false, bare: false });
  await addAnUpstream(dir2);
}

/**
 * Simulate another repo push to upstream, letting our local repo being behind.
 * Have to run `createAndSyncRepo2ToRemote()` before this.
 */
export async function anotherRepo2PushSomeFiles() {
  await GitProcess.exec(['fetch', defaultGitInfo.remote], dir2);
  try {
    // this can fail if dir1 never push its initial commit to the remote, so remote is still bare and can't be pull. It is OK to ignore this error.
    await mergeUpstream(dir2, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
  } catch {}
  await addSomeFiles(dir2);
  await commitFiles(dir2, defaultGitInfo.gitUserName, defaultGitInfo.email);
  await pushUpstream(dir2, defaultGitInfo.branch, defaultGitInfo.remote, { ...defaultGitInfo, accessToken: exampleToken });
}
