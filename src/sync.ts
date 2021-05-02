import fs from 'fs-extra';
import git from 'isomorphic-git';
import { CantSyncInSpecialGitStateAutoFixFailed, SyncScriptIsInDeadLoopError } from './errors';
import { getGitRepositoryState, getModifiedFileList } from './inspect';
import { GitStep, ILogger } from './interface';

/**
 * Git add and commit all file
 * https://github.com/isomorphic-git/isomorphic-git/issues/1182#issuecomment-830756782
 * @param dir
 * @param name
 * @param email
 * @param message
 */
export async function commitAllFiles(dir: string, name: string, email: string, message = 'Initialize with Git-Sync-JS'): Promise<string> {
  const unstagedFilePaths = await getModifiedFileList(dir);
  await Promise.all(unstagedFilePaths.map(({ filepath }) => git.add({ fs, dir, filepath })));
  const sha = await git.commit({
    fs,
    dir: '/tutorial',
    author: {
      name,
      email,
    },
    message,
  });
  return sha;
}

/**
 * try to continue rebase, simply adding and committing all things, leave them to user to resolve in the TiddlyWiki later.
 * @param dir
 * @param username
 * @param email
 */
export async function continueRebase(dir: string, username: string, email: string, logger?: ILogger): Promise<void> {
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'continueRebase',
      step,
      dir,
    });

  let hasNotCommittedConflict = true;
  let rebaseContinueExitCode = 0;
  let rebaseContinueStdError = '';
  let repositoryState = await getGitRepositoryState(dir, logger);
  // prevent infin loop, if there is some bug that I miss
  let loopCount = 0;
  while (hasNotCommittedConflict) {
    loopCount += 1;
    if (loopCount > 1000) {
      throw new SyncScriptIsInDeadLoopError();
    }
    const { exitCode: commitExitCode, stderr: commitStdError } = await commitAllFiles(dir, username, email, 'Conflict files committed with TiddlyGit-Desktop');
    const rebaseContinueResult = await GitProcess.exec(['rebase', '--continue'], dir);
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
