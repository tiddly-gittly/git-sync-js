import { exec, type IGitStringResult } from 'dugite';

import { CantSyncInSpecialGitStateAutoFixFailed, GitPullPushError, SyncScriptIsInDeadLoopError } from './errors';
import { getGitRepositoryState } from './inspect';
import { GitStep, IGitUserInfos, IGitUserInfosWithoutToken, ILogger } from './interface';
import { toGitStringResult } from './utils';

/**
 * Git add and commit all file
 * @param dir
 * @param username
 * @param email
 * @param message
 */
export async function commitFiles(
  dir: string,
  username: string,
  email: string,
  message = 'Commit with Git-Sync-JS',
  filesToIgnore: string[] = [],
  logger?: ILogger,
): Promise<IGitStringResult> {
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'commitFiles',
      step,
      dir,
    });
  const logDebug = (message: string, step: GitStep): unknown =>
    logger?.debug(message, {
      functionName: 'commitFiles',
      step,
      dir,
    });

  logProgress(GitStep.AddingFiles);
  logDebug(`Executing: git add . in ${dir}`, GitStep.AddingFiles);
  const addResult = toGitStringResult(await exec(['add', '.'], dir));
  logDebug(`git add exitCode: ${addResult.exitCode}, stdout: ${addResult.stdout || '(empty)'}, stderr: ${addResult.stderr || '(empty)'}`, GitStep.AddingFiles);
  
  // Check what's actually in the staging area
  const statusResult = toGitStringResult(await exec(['status', '--porcelain'], dir));
  logDebug(`git status --porcelain: ${statusResult.stdout || '(empty)'}`, GitStep.AddingFiles);
  
  // Check staged files using git diff --cached
  const diffCachedResult = toGitStringResult(await exec(['diff', '--cached', '--name-only'], dir));
  const actualStagedFiles = diffCachedResult.stdout.trim().split('\n').filter(f => f.length > 0);
  logDebug(`Actual staged files count (from git diff --cached): ${actualStagedFiles.length}`, GitStep.AddingFiles);
  if (actualStagedFiles.length > 0) {
    logDebug(`Actual staged files: ${actualStagedFiles.slice(0, 10).join(', ')}${actualStagedFiles.length > 10 ? ` ... (${actualStagedFiles.length - 10} more)` : ''}`, GitStep.AddingFiles);
  } else {
    logDebug('No files in staging area after git add!', GitStep.AddingFiles);
  }
  
  // find and unStage files that are in the ignore list
  if (filesToIgnore.length > 0) {
    // Get all tracked files using git ls-files
    const lsFilesResult = toGitStringResult(await exec(['ls-files'], dir));
    const trackedFiles = lsFilesResult.stdout.trim().split('\n').filter(f => f.length > 0);
    logDebug(`Total tracked files count (from git ls-files): ${trackedFiles.length}`, GitStep.AddingFiles);
    
    const stagedFilesToIgnore = filesToIgnore.filter((file) => trackedFiles.includes(file));
    logDebug(`Files to ignore count: ${filesToIgnore.length}, staged files to ignore count: ${stagedFilesToIgnore.length}`, GitStep.AddingFiles);
    if (stagedFilesToIgnore.length > 0) {
      logDebug(`Unstaging files: ${stagedFilesToIgnore.join(', ')}`, GitStep.AddingFiles);
      // Use git reset to unstage files
      await Promise.all(stagedFilesToIgnore.map(async (file) => {
        await exec(['reset', 'HEAD', file], dir);
      }));
      // Re-check staging area after removal
      const diffCachedAfterRemove = toGitStringResult(await exec(['diff', '--cached', '--name-only'], dir));
      const remainingStagedFiles = diffCachedAfterRemove.stdout.trim().split('\n').filter(f => f.length > 0);
      logDebug(`Remaining staged files count after unstaging: ${remainingStagedFiles.length}`, GitStep.AddingFiles);
    }
  }

  logProgress(GitStep.AddComplete);
  logDebug(`Executing: git commit -m "${message}" --author="${username} <${email}>"`, GitStep.CommitComplete);
  const commitResult = toGitStringResult(await exec(['commit', '-m', message, `--author="${username} <${email}>"`], dir));
  logDebug(`git commit exitCode: ${commitResult.exitCode}, stdout: ${commitResult.stdout || '(empty)'}, stderr: ${commitResult.stderr || '(empty)'}`, GitStep.CommitComplete);
  
  if (commitResult.exitCode === 1 && commitResult.stdout.includes('nothing to commit')) {
    logDebug('Git commit reports "nothing to commit" - this is expected if staging area is empty', GitStep.CommitComplete);
  }
  
  return commitResult;
}

/**
 * Git push -f origin master
 * This does force push, to deal with `--allow-unrelated-histories` case
 * @param dir
 * @param username
 * @param email
 * @param message
 */
export async function pushUpstream(
  dir: string,
  branch: string,
  remoteName: string,
  userInfo?: IGitUserInfos | IGitUserInfosWithoutToken,
  logger?: ILogger,
): Promise<IGitStringResult> {
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'pushUpstream',
      step,
      dir,
    });
  /** when push to remote, we need to specify the local branch name and remote branch name */
  const branchMapping = `${branch}:${branch}`;
  logProgress(GitStep.GitPush);
  const pushResult = toGitStringResult(await exec(['push', remoteName, branchMapping], dir));
  logProgress(GitStep.GitPushComplete);
  if (pushResult.exitCode !== 0) {
    throw new GitPullPushError({ dir, branch, remote: remoteName, userInfo }, pushResult.stdout + pushResult.stderr);
  }
  return pushResult;
}

/**
 * Git merge origin master
 * @param dir
 * @param username
 * @param email
 * @param message
 */
export async function mergeUpstream(
  dir: string,
  branch: string,
  remoteName: string,
  userInfo?: IGitUserInfos | IGitUserInfosWithoutToken,
  logger?: ILogger,
): Promise<IGitStringResult> {
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'mergeUpstream',
      step,
      dir,
    });
  logProgress(GitStep.GitMerge);
  const mergeResult = toGitStringResult(await exec(['merge', '--ff', '--ff-only', `${remoteName}/${branch}`], dir));
  logProgress(GitStep.GitMergeComplete);
  if (mergeResult.exitCode !== 0) {
    throw new GitPullPushError({ dir, branch, remote: remoteName, userInfo }, mergeResult.stdout + mergeResult.stderr);
  }

  return mergeResult;
}

/**
 * try to continue rebase, simply adding and committing all things, leave them to user to resolve in the TiddlyWiki later.
 * @param dir
 * @param username
 * @param email
 * @param providedRepositoryState result of `await getGitRepositoryState(dir, logger)`, optional, if not provided, we will run `await getGitRepositoryState(dir, logger)` by ourself.
 */
export async function continueRebase(dir: string, username: string, email: string, logger?: ILogger, providedRepositoryState?: string): Promise<void> {
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'continueRebase',
      step,
      dir,
    });

  let hasNotCommittedConflict = true;
  let rebaseContinueExitCode = 0;
  let rebaseContinueStdError = '';
  let repositoryState: string = providedRepositoryState ?? (await getGitRepositoryState(dir, logger));
  // prevent infin loop, if there is some bug that I miss
  let loopCount = 0;
  while (hasNotCommittedConflict) {
    loopCount += 1;
    if (loopCount > 1000) {
      throw new SyncScriptIsInDeadLoopError();
    }
    const { exitCode: commitExitCode, stderr: commitStdError } = await commitFiles(dir, username, email, 'Conflict files committed with Git-Sync-JS', [], logger);
    const rebaseContinueResult = toGitStringResult(await exec(['rebase', '--continue'], dir));
    // get info for logging
    rebaseContinueExitCode = rebaseContinueResult.exitCode;
    rebaseContinueStdError = rebaseContinueResult.stderr;
    const rebaseContinueStdOut = rebaseContinueResult.stdout;
    repositoryState = await getGitRepositoryState(dir, logger);
    // if git add . + git commit failed or git rebase --continue failed
    if (commitExitCode !== 0 || rebaseContinueExitCode !== 0) {
      throw new CantSyncInSpecialGitStateAutoFixFailed(
        `rebaseContinueStdError when ${repositoryState}: ${rebaseContinueStdError}\ncommitStdError when ${repositoryState}: ${commitStdError}\n${rebaseContinueStdError}`,
      );
    }
    hasNotCommittedConflict = rebaseContinueStdError.startsWith('CONFLICT') || rebaseContinueStdOut.startsWith('CONFLICT');
  }
  logProgress(GitStep.CantSyncInSpecialGitStateAutoFixSucceed);
}

/**
 * Simply calling git fetch.
 * @param branch if not provided, will fetch all branches
 */
export async function fetchRemote(dir: string, remoteName: string, branch?: string, logger?: ILogger) {
  const logDebug = (message: string): unknown =>
    logger?.debug(message, {
      functionName: 'fetchRemote',
      step: GitStep.FetchingData,
      dir,
    });

  logDebug(`Fetching from ${remoteName}${branch ? ` branch ${branch}` : ' all branches'}`);
  if (branch === undefined) {
    await exec(['fetch', remoteName], dir);
  } else {
    await exec(['fetch', remoteName, branch], dir);
  }
  logDebug(`Fetch completed from ${remoteName}`);
}
