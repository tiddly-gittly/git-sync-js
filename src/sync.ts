/* eslint-disable unicorn/prevent-abbreviations */
import { GitProcess, IGitResult } from 'dugite';
import git from 'isomorphic-git';
import fs from 'fs-extra';

import { CantSyncInSpecialGitStateAutoFixFailed, SyncScriptIsInDeadLoopError } from './errors';
import { getGitRepositoryState } from './inspect';
import { GitStep, ILogger } from './interface';

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
  message = 'Initialize with TiddlyGit-Desktop',
  logger?: ILogger,
): Promise<IGitResult> {
  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'commitFiles',
      step,
      dir,
    });

  logProgress(GitStep.AddingFiles);
  await git.add({ dir, filepath: '.', fs });
  logProgress(GitStep.AddComplete);
  return await GitProcess.exec(['commit', '-m', message, `--author="${username} <${email}>"`], dir);
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
    const { exitCode: commitExitCode, stderr: commitStdError } = await commitFiles(dir, username, email, 'Conflict files committed with TiddlyGit-Desktop');
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
