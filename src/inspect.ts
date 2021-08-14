/* eslint-disable unicorn/prevent-abbreviations */
import fs from 'fs-extra';
import path from 'path';
import { compact } from 'lodash';
import { GitProcess } from 'dugite';
import url from 'url';
import { GitStep, ILogger } from './interface';
import { AssumeSyncError, CantSyncGitNotInitializedError } from './errors';

export interface ModifiedFileList {
  type: string;
  fileRelativePath: string;
  filePath: string;
}
/**
 * Get modified files and modify type in a folder
 * @param {string} wikiFolderPath location to scan git modify state
 */
export async function getModifiedFileList(wikiFolderPath: string): Promise<ModifiedFileList[]> {
  const { stdout } = await GitProcess.exec(['status', '--porcelain'], wikiFolderPath);
  const stdoutLines = stdout.split('\n');
  const nonEmptyLines = compact(stdoutLines);
  const statusMatrixLines = (compact(nonEmptyLines.map((line: string) => /^\s?(\?\?|[ACMR]|[ACMR][DM])\s?(\S+.*\S+)$/.exec(line))).filter(
    ([_, type, fileRelativePath]) => type !== undefined && fileRelativePath !== undefined,
  ) as unknown) as Array<[unknown, string, string]>;
  return statusMatrixLines.map(([_, type, rawFileRelativePath]) => {
    /**
     * If filename contains Chinese, it will becomes:
     * ```js
     * fileRelativePath: "\"tiddlers/\\346\\226\\260\\346\\235\\241\\347\\233\\256.tid\""`
     * ```
     * which is actually `"tiddlers/\\346\\226\\260\\346\\235\\241\\347\\233\\256.tid"` (if you try to type it in the console manually). If you console log it, it will become
     * ```js
     * > temp1[1].fileRelativePath
     * '"tiddlers/\346\226\260\346\235\241\347\233\256.tid"'
     * ```
     *
     * So simply `decodeURIComponent(escape` will work on `tiddlers/\346\226\260\346\235\241\347\233\256.tid` (the logged string), but not on `tiddlers/\\346\\226\\260\\346\\235\\241\\347\\233\\256.tid` (the actual string).
     * So how to transform actual string to logged string? Answer is `eval()` it. But we have to check is there any evil script use `;` or `,` mixed into the filename.
     */
    const isSafeUtf8UnescapedString =
      rawFileRelativePath.startsWith('"') && rawFileRelativePath.endsWith('"') && !rawFileRelativePath.includes(';') && !rawFileRelativePath.includes(',');
    function decode(str: string): string {
      return str.replace(/\\(\d{3})\\(\d{3})\\(\d{3})/g, (_: unknown, $1: string, $2: string, $3: string) =>
        decodeURIComponent(`%${Number.parseInt($1, 8).toString(16)}%${Number.parseInt($2, 8).toString(16)}%${Number.parseInt($3, 8).toString(16)}`),
      );
    }
    const fileRelativePath = isSafeUtf8UnescapedString ? decode(rawFileRelativePath).replace(/^"/, '').replace(/"$/, '') : rawFileRelativePath;
    return {
      type,
      fileRelativePath,
      filePath: path.join(wikiFolderPath, fileRelativePath),
    };
  });
}

/**
 * Inspect git's remote url from folder's .git config
 * @param wikiFolderPath git folder to inspect
 * @returns remote url
 */
export async function getRemoteUrl(wikiFolderPath: string): Promise<string> {
  const { stdout: remoteStdout } = await GitProcess.exec(['remote'], wikiFolderPath);
  const remotes = compact(remoteStdout.split('\n'));
  const githubRemote = remotes.find((remote) => remote === 'origin') ?? remotes[0] ?? '';
  if (githubRemote.length > 0) {
    const { stdout: remoteUrlStdout } = await GitProcess.exec(['remote', 'get-url', githubRemote], wikiFolderPath);
    return remoteUrlStdout.replace('.git', '');
  }
  return '';
}

/**
 * get the Github Repo Name, similar to "linonetwo/wiki", string after "https://github.com/"
 * @param remoteUrl full github repository url or other repository url
 * @returns
 */
export function getRemoteRepoName(remoteUrl: string): string | undefined {
  let wikiRepoName = new url.URL(remoteUrl).pathname;
  if (wikiRepoName.startsWith('/')) {
    // deepcode ignore GlobalReplacementRegex: change only the first match
    wikiRepoName = wikiRepoName.replace('/', '');
  }
  if (wikiRepoName.length > 0) {
    return wikiRepoName;
  }
  return undefined;
}

/**
 * See if there is any file not being committed
 * @param {string} wikiFolderPath repo path to test
 */
export async function haveLocalChanges(wikiFolderPath: string): Promise<boolean> {
  const { stdout } = await GitProcess.exec(['status', '--porcelain'], wikiFolderPath);
  const matchResult = stdout.match(/^(\?\?|[ACMR] |[ ACMR][DM])*/gm);
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  return !!matchResult?.some?.((match: string) => Boolean(match));
}

/**
 * Get "master" or "main" from git repo
 * @param wikiFolderPath
 */
export async function getDefaultBranchName(wikiFolderPath: string): Promise<string> {
  const { stdout } = await GitProcess.exec(['remote', 'show', 'origin'], wikiFolderPath);
  const lines = stdout.split('\n');
  const lineWithHEAD = lines.find((line: string) => line.includes('HEAD branch: '));
  const branchName = lineWithHEAD?.replace?.('HEAD branch: ', '')?.replace?.(/\s/g, '');
  if (branchName === undefined || branchName.includes('(unknown)')) {
    return 'master';
  }
  return branchName;
}

export type SyncState = 'noUpstream' | 'equal' | 'ahead' | 'behind' | 'diverged';
/**
 * determine sync state of repository, i.e. how the remote relates to our HEAD
 * 'ahead' means our local state is ahead of remote, 'behind' means local state is behind of the remote
 * @param dir repo path to test
 */
export async function getSyncState(dir: string, logger?: ILogger, defaultBranchName?: string): Promise<SyncState> {
  const logDebug = (message: string, step: GitStep): unknown => logger?.log?.(message, { functionName: 'getSyncState', step, dir });
  const logProgress = (step: GitStep): unknown =>
    logger?.info?.(step, {
      functionName: 'getSyncState',
      step,
      dir,
    });

  if (defaultBranchName === undefined) {
    defaultBranchName = await getDefaultBranchName(dir);
  }
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

export async function assumeSync(wikiFolderPath: string, logger?: ILogger, defaultBranchName?: string): Promise<void> {
  if ((await getSyncState(wikiFolderPath, logger, defaultBranchName)) === 'equal') {
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
  const [isRebaseI, isRebaseM, isAMRebase, isMerging, isCherryPicking, isBisecting, isInsideGitDir] = await Promise.all([
    ((await fs.lstat(path.join(gitDirectory, 'rebase-merge', 'interactive')).catch(() => ({}))) as fs.Stats)?.isFile?.(),
    ((await fs.lstat(path.join(gitDirectory, 'rebase-merge')).catch(() => ({}))) as fs.Stats)?.isDirectory?.(),
    ((await fs.lstat(path.join(gitDirectory, 'rebase-apply')).catch(() => ({}))) as fs.Stats)?.isDirectory?.(),
    ((await fs.lstat(path.join(gitDirectory, 'MERGE_HEAD')).catch(() => ({}))) as fs.Stats)?.isFile?.(),
    ((await fs.lstat(path.join(gitDirectory, 'CHERRY_PICK_HEAD')).catch(() => ({}))) as fs.Stats)?.isFile?.(),
    ((await fs.lstat(path.join(gitDirectory, 'BISECT_LOG')).catch(() => ({}))) as fs.Stats)?.isFile?.(),
    (await GitProcess.exec(['rev-parse', '--is-inside-git-dir', wikiFolderPath], wikiFolderPath))?.stdout?.startsWith('true'),
  ]);
  let result = '';
  /* eslint-disable @typescript-eslint/strict-boolean-expressions */
  if (isRebaseI) {
    result += 'REBASE-i';
  } else if (isRebaseM) {
    result += 'REBASE-m';
  } else {
    if (isAMRebase) {
      result += 'AM/REBASE';
    }
    if (isMerging) {
      result += 'MERGING';
    }
    if (isCherryPicking) {
      result += 'CHERRY-PICKING';
    }
    if (isBisecting) {
      result += 'BISECTING';
    }
  }
  if (isInsideGitDir) {
    result += (await GitProcess.exec(['rev-parse', '--is-bare-repository', wikiFolderPath], wikiFolderPath)).stdout.startsWith('true') ? '|BARE' : '|GIT_DIR';
  } else if ((await GitProcess.exec(['rev-parse', '--is-inside-work-tree', wikiFolderPath], wikiFolderPath)).stdout.startsWith('true')) {
    const { exitCode } = await GitProcess.exec(['diff', '--no-ext-diff', '--quiet', '--exit-code'], wikiFolderPath);
    // 1 if there were differences and 0 means no differences.
    if (exitCode !== 0) {
      result += '|DIRTY';
    }
  }
  /* eslint-enable @typescript-eslint/strict-boolean-expressions */
  return result;
}

/**
 * echo the git dir
 * @param dir repo path
 */
export async function getGitDirectory(dir: string, logger?: ILogger): Promise<string> {
  const logDebug = (message: string, step: GitStep): unknown => logger?.log?.(message, { functionName: 'getSyncState', step, dir });
  const logProgress = (step: GitStep): unknown =>
    logger?.info?.(step, {
      functionName: 'getSyncState',
      step,
      dir,
    });

  logProgress(GitStep.CheckingLocalGitRepoSanity);
  const { stdout, stderr } = await GitProcess.exec(['rev-parse', '--is-inside-work-tree', dir], dir);
  if (typeof stderr === 'string' && stderr.length > 0) {
    logDebug(stderr, GitStep.CheckingLocalGitRepoSanity);
    throw new CantSyncGitNotInitializedError(dir);
  }
  if (stdout.startsWith('true')) {
    const { stdout: stdout2 } = await GitProcess.exec(['rev-parse', '--git-dir', dir], dir);
    const [gitPath2, gitPath1] = compact(stdout2.split('\n'));
    if (gitPath2 !== undefined && gitPath1 !== undefined) {
      return path.resolve(`${gitPath1}/${gitPath2}`);
    }
  }
  throw new CantSyncGitNotInitializedError(dir);
}

/** Check if dir has `.git`. */
export async function hasGit(dir: string): Promise<boolean> {
  try {
    await getGitDirectory(dir);
  } catch (error) {
    if (error instanceof CantSyncGitNotInitializedError) {
      return false;
    }
  }
  return true;
}
