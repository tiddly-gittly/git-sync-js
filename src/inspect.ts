import fs from 'fs-extra';
import path from 'path';
import { compact } from 'lodash';
import git from 'isomorphic-git';
import url from 'url';
import { GitStep, ILogger } from './interface';
import { AssumeSyncError, CantSyncGitNotInitializedError } from './errors';

export interface ModifiedFileList {
  fileRelativePath: string;
  filepath: string;
}
/**
 * Get modified files and modify type in a folder. We assume that unstaged files are modified files (no one else runs `git add xxx`)
 * @param {string} dir location to scan git modify state
 */
export async function getModifiedFileList(dir: string): Promise<ModifiedFileList[]> {
  const unstagedFileRelativePaths = (await git.statusMatrix({ dir, fs })).filter((row) => row[2] !== row[3]).map((row) => row[0]);
  return unstagedFileRelativePaths.map((fileRelativePath) => ({
    fileRelativePath,
    filepath: path.join(dir, fileRelativePath),
  }));
}

/**
 * Inspect git's remote url from folder's .git config
 * @param dir git folder to inspect
 * @returns remote url
 */
export async function getRemoteUrl(dir: string): Promise<string> {
  const { stdout: remoteStdout } = await GitProcess.exec(['remote'], dir);
  const remotes = compact(remoteStdout.split('\n'));
  const githubRemote = remotes.find((remote) => remote === 'origin') ?? remotes[0] ?? '';
  if (githubRemote.length > 0) {
    const { stdout: remoteUrlStdout } = await GitProcess.exec(['remote', 'get-url', githubRemote], dir);
    return remoteUrlStdout.replace('.git', '');
  }
  return '';
}

/**
 * get the Github Repo Name, similar to "linonetwo/wiki", string after "https://github.com/"
 * @param remoteUrl full github repository url or other repository url
 * @returns
 */
export async function getRemoteRepoName(remoteUrl: string): Promise<string | undefined> {
  let wikiRepoName = new url.URL(remoteUrl).pathname;
  if (wikiRepoName.startsWith('/')) {
    // deepcode ignore GlobalReplacementRegex: will change only the first match
    wikiRepoName = wikiRepoName.replace('/', '');
  }
  if (wikiRepoName.length > 0) {
    return wikiRepoName;
  }
  return;
}

/**
 * See if there is any file not being committed
 * @param {string} wikiFolderPath repo path to test
 */
export async function haveLocalChanges(wikiFolderPath: string): Promise<boolean> {
  const { stdout } = await GitProcess.exec(['status', '--porcelain'], wikiFolderPath);
  const matchResult = stdout.match(/^(\?\?|[ACMR] |[ ACMR][DM])*/gm);
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  return !!matchResult?.some((match: string) => Boolean(match));
}

/**
 * Get "master" or "main" from git repo, we assume it is the head branch
 * @param dir
 */
export async function getDefaultBranchName(dir: string): Promise<string> {
  const branchName = (await git.currentBranch({ dir, fs })) ?? (await git.listBranches({ dir, fs }))[0];
  return branchName || 'master';
}

export type SyncState = 'noUpstream' | 'equal' | 'ahead' | 'behind' | 'diverged';
/**
 * determine sync state of repository, i.e. how the remote relates to our HEAD
 * 'ahead' means our local state is ahead of remote, 'behind' means local state is behind of the remote
 * @param dir repo path to test
 */
export async function getSyncState(dir: string, logger?: ILogger): Promise<SyncState> {
  const logDebug = (message: string, step: GitStep): unknown => logger?.log(message, { functionName: 'getSyncState', step, dir });
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'getSyncState',
      step,
      dir,
    });

  const defaultBranchName = await getDefaultBranchName(dir);
  logProgress(GitStep.CheckingLocalSyncState);
  const { stdout } = await GitProcess.exec(['rev-list', '--count', '--left-right', `origin/${defaultBranchName}...HEAD`], dir);
  logDebug(`Checking sync state with upstream, stdout:\n${stdout}\n(stdout end)`, GitStep.CheckingLocalSyncState);

  if (stdout === '') {
    return 'noUpstream';
  }
  if (/0\t0/.exec(stdout) !== null) {
    return 'equal';
  }
  if (/0\t\d+/.exec(stdout) !== null) {
    return 'ahead';
  }
  if (/\d+\t0/.exec(stdout) !== null) {
    return 'behind';
  }
  return 'diverged';
}

export async function assumeSync(wikiFolderPath: string, logger?: ILogger): Promise<void> {
  if ((await getSyncState(wikiFolderPath, logger)) === 'equal') {
    return;
  }
  throw new AssumeSyncError();
}

/**
 * get various repo state in string format
 * @param wikiFolderPath repo path to check
 * @returns gitState
 * // TODO: use template literal type to get exact type of git state
 */
export async function getGitRepositoryState(wikiFolderPath: string, logger?: ILogger): Promise<string> {
  const gitDirectory = await getGitDirectory(wikiFolderPath, logger);
  if (typeof gitDirectory !== 'string' || gitDirectory.length === 0) {
    return 'NOGIT';
  }
  let result = '';
  if (((await fs.lstat(path.join(gitDirectory, 'rebase-merge', 'interactive')).catch(() => ({}))) as fs.Stats)?.isFile()) {
    result += 'REBASE-i';
  } else if (((await fs.lstat(path.join(gitDirectory, 'rebase-merge')).catch(() => ({}))) as fs.Stats)?.isDirectory()) {
    result += 'REBASE-m';
  } else {
    if (((await fs.lstat(path.join(gitDirectory, 'rebase-apply')).catch(() => ({}))) as fs.Stats)?.isDirectory()) {
      result += 'AM/REBASE';
    }
    if (((await fs.lstat(path.join(gitDirectory, 'MERGE_HEAD')).catch(() => ({}))) as fs.Stats)?.isFile()) {
      result += 'MERGING';
    }
    if (((await fs.lstat(path.join(gitDirectory, 'CHERRY_PICK_HEAD')).catch(() => ({}))) as fs.Stats)?.isFile()) {
      result += 'CHERRY-PICKING';
    }
    if (((await fs.lstat(path.join(gitDirectory, 'BISECT_LOG')).catch(() => ({}))) as fs.Stats)?.isFile()) {
      result += 'BISECTING';
    }
  }
  if ((await GitProcess.exec(['rev-parse', '--is-inside-git-dir', wikiFolderPath], wikiFolderPath)).stdout.startsWith('true')) {
    result += (await GitProcess.exec(['rev-parse', '--is-bare-repository', wikiFolderPath], wikiFolderPath)).stdout.startsWith('true') ? '|BARE' : '|GIT_DIR';
  } else if ((await GitProcess.exec(['rev-parse', '--is-inside-work-tree', wikiFolderPath], wikiFolderPath)).stdout.startsWith('true')) {
    const { exitCode } = await GitProcess.exec(['diff', '--no-ext-diff', '--quiet', '--exit-code'], wikiFolderPath);
    // 1 if there were differences and 0 means no differences.
    if (exitCode !== 0) {
      result += '|DIRTY';
    }
  }
  return result;
}

/**
 * echo the git dir
 * @param dir repo path
 */
async function getGitDirectory(dir: string, logger?: ILogger): Promise<string> {
  const logDebug = (message: string, step: GitStep): unknown => logger?.log(message, { functionName: 'getSyncState', step, dir });
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'getSyncState',
      step,
      dir,
    });

  logProgress(GitStep.CheckingLocalGitRepoSanity);
  const { stdout, stderr } = await GitProcess.exec(['rev-parse', '--is-inside-work-tree', dir], dir);
  if (typeof stderr === 'string' && stderr.length > 0) {
    logDebug(stderr, GitStep.CheckingLocalGitRepoSanity);
  }
  if (stdout.startsWith('true')) {
    const { stdout: stdout2 } = await GitProcess.exec(['rev-parse', '--git-dir', dir], dir);
    const [gitPath2, gitPath1] = compact(stdout2.split('\n'));
    if (gitPath2 && gitPath1) {
      return path.resolve(`${gitPath1}/${gitPath2}`);
    }
  }
  throw new CantSyncGitNotInitializedError(dir);
}
