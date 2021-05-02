import { truncate } from 'lodash';
import git from 'isomorphic-git';

import { GitStep, IGitUserInfos, ILogger } from './interface';
import { defaultGitInfo } from './defaultGitInfo';
import { CantSyncGitNotInitializedError, GitPullPushError, SyncParameterMissingError } from './errors';
import { credentialOn, credentialOff } from './credential';
import { getDefaultBranchName, getGitRepositoryState, haveLocalChanges, getSyncState, assumeSync } from './inspect';
import { commitAllFiles, continueRebase } from './sync';

export * from './interface';
export * from './defaultGitInfo';
export * from './errors';
export * from './credential';
export * from './inspect';
export * from './sync';

export async function initGit(options: {
  /** wiki folder path, can be relative */
  dir: string;
  /** should we sync after git init? */
  syncImmediately?: boolean;
  /** the storage service url we are sync to, for example your github repo url */
  remoteUrl?: string;
  /** user info used in the commit message */
  userInfo?: IGitUserInfos;
  logger?: ILogger;
}): Promise<void> {
  const logProgress = (step: GitStep): unknown =>
    options.logger?.info(step, {
      functionName: 'initGit',
      step,
    });
  const logDebug = (message: string, step: GitStep): unknown => options.logger?.log(message, { functionName: 'initGit', step });

  logProgress(GitStep.StartGitInitialization);
  const { gitUserName, email } = options.userInfo ?? defaultGitInfo;
  await GitProcess.exec(['init'], options.dir);
  await commitAllFiles(options.dir, gitUserName, email);

  // if we are config local note git, we are done here
  if (options.syncImmediately !== true) {
    logProgress(GitStep.GitRepositoryConfigurationFinished);
    return;
  }
  // sync to remote, start config synced note
  if (options.userInfo?.accessToken === undefined || options.userInfo?.accessToken?.length === 0) {
    throw new SyncParameterMissingError('accessToken');
  }
  if (options.remoteUrl === undefined || options.remoteUrl.length === 0) {
    throw new SyncParameterMissingError('remoteUrl');
  }
  logDebug(
    `Using gitUrl ${options.remoteUrl} with gitUserName ${gitUserName} and accessToken ${truncate(options.userInfo?.accessToken, {
      length: 24,
    })}`,
    GitStep.StartConfiguringGithubRemoteRepository,
  );
  logProgress(GitStep.StartConfiguringGithubRemoteRepository);
  await credentialOn(options.dir, options.remoteUrl, gitUserName, options.userInfo?.accessToken);
  logProgress(GitStep.StartBackupToGitRemote);
  const defaultBranchName = await getDefaultBranchName(options.dir);
  const { stderr: pushStdError, exitCode: pushExitCode } = await GitProcess.exec(['push', 'origin', `${defaultBranchName}:${defaultBranchName}`], options.dir);
  await credentialOff(options.dir);
  if (pushExitCode !== 0) {
    logProgress(GitStep.GitPushFailed);
    throw new GitPullPushError(options, pushStdError);
  } else {
    logProgress(GitStep.SynchronizationFinish);
  }
}

/**
 * `git add .` + `git commit` + `git rebase` or something that can sync bi-directional
 */
export async function commitAndSync(options: {
  /** wiki folder path, can be relative */
  dir: string;
  /** the storage service url we are sync to, for example your github repo url */
  remoteUrl?: string;
  /** user info used in the commit message */
  userInfo?: IGitUserInfos;
  /** the commit message */
  commitMessage?: string;
  logger?: ILogger;
}): Promise<void> {
  const { dir, remoteUrl, commitMessage = 'Updated with Git-Sync' } = options;
  const { gitUserName, email } = options.userInfo ?? defaultGitInfo;
  const { accessToken } = options.userInfo ?? {};

  if (accessToken === '' || accessToken === undefined) {
    throw new SyncParameterMissingError('accessToken');
  }
  if (remoteUrl === '' || remoteUrl === undefined) {
    throw new SyncParameterMissingError('remoteUrl');
  }

  const logProgress = (step: GitStep): unknown =>
    options.logger?.info(step, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
    });
  const logDebug = (message: string, step: GitStep): unknown =>
    options.logger?.log(message, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
    });
  const logWarn = (message: string, step: GitStep): unknown =>
    options.logger?.warn(message, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
    });

  const defaultBranchName = await getDefaultBranchName(dir);
  /** when push to origin, we need to specify the local branch name and remote branch name */
  const branchMapping = `${defaultBranchName}:${defaultBranchName}`;

  // preflight check
  const repoStartingState = await getGitRepositoryState(dir, options.logger);
  if (repoStartingState.length > 0 || repoStartingState === '|DIRTY') {
    logProgress(GitStep.PrepareSync);
    logDebug(`${dir} , ${gitUserName} <${email}>`, GitStep.PrepareSync);
  } else if (repoStartingState === 'NOGIT') {
    throw new CantSyncGitNotInitializedError(dir);
  } else {
    // we may be in middle of a rebase, try fix that
    await continueRebase(dir, gitUserName, email, options.logger);
  }
  if (await haveLocalChanges(dir)) {
    logProgress(GitStep.HaveThingsToCommit);
    logDebug(commitMessage, GitStep.HaveThingsToCommit);
    const { exitCode: commitExitCode, stderr: commitStdError } = await commitAllFiles(dir, gitUserName, email, commitMessage);
    if (commitExitCode !== 0) {
      logWarn(`commit failed ${commitStdError}`, GitStep.CommitComplete);
    }
    logProgress(GitStep.CommitComplete);
  }
  logProgress(GitStep.PreparingUserInfo);
  await credentialOn(dir, remoteUrl, gitUserName, accessToken);
  logProgress(GitStep.FetchingData);
  await GitProcess.exec(['fetch', 'origin', defaultBranchName], dir);
  //
  switch (await getSyncState(dir, options.logger)) {
    case 'noUpstream': {
      await credentialOff(dir);
      throw new CantSyncGitNotInitializedError(dir);
    }
    case 'equal': {
      logProgress(GitStep.NoNeedToSync);
      await credentialOff(dir);
      return;
    }
    case 'ahead': {
      logProgress(GitStep.LocalAheadStartUpload);
      const { exitCode, stderr } = await GitProcess.exec(['push', 'origin', branchMapping], dir);
      if (exitCode === 0) {
        break;
      }
      logWarn(`exitCode: ${exitCode}, stderr of git push: ${stderr}`, GitStep.GitPushFailed);
      break;
    }
    case 'behind': {
      logProgress(GitStep.LocalStateBehindSync);
      const { exitCode, stderr } = await GitProcess.exec(['merge', '--ff', '--ff-only', `origin/${defaultBranchName}`], dir);
      if (exitCode === 0) {
        break;
      }
      logWarn(`exitCode: ${exitCode}, stderr of git merge: ${stderr}`, GitStep.GitMergeFailed);
      break;
    }
    case 'diverged': {
      logProgress(GitStep.LocalStateDivergeRebase);
      const { exitCode } = await GitProcess.exec(['rebase', `origin/${defaultBranchName}`], dir);
      logProgress(GitStep.RebaseResultChecking);
      if (exitCode === 0 && (await getGitRepositoryState(dir, options.logger)).length === 0 && (await getSyncState(dir, options.logger)) === 'ahead') {
        logProgress(GitStep.RebaseSucceed);
      } else {
        await continueRebase(dir, gitUserName, email, options.logger);
        logProgress(GitStep.RebaseConflictNeedsResolve);
      }
      await GitProcess.exec(['push', 'origin', branchMapping], dir);
      break;
    }
    default: {
      logProgress(GitStep.SyncFailedAlgorithmWrong);
    }
  }
  await credentialOff(dir);
  logProgress(GitStep.PerformLastCheckBeforeSynchronizationFinish);
  await assumeSync(dir, options.logger);
  logProgress(GitStep.SynchronizationFinish);
}

export async function clone(options: {
  /** wiki folder path, can be relative */
  dir: string;
  /** the storage service url we are sync to, for example your github repo url */
  remoteUrl?: string;
  /** user info used in the commit message */
  userInfo?: IGitUserInfos;
  logger?: ILogger;
}): Promise<void> {
  const { dir, remoteUrl } = options;
  const { gitUserName } = options.userInfo ?? defaultGitInfo;
  const { accessToken } = options.userInfo ?? {};

  if (accessToken === '' || accessToken === undefined) {
    throw new SyncParameterMissingError('accessToken');
  }
  if (remoteUrl === '' || remoteUrl === undefined) {
    throw new SyncParameterMissingError('remoteUrl');
  }

  const logProgress = (step: GitStep): unknown =>
    options.logger?.info(step, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
    });
  const logDebug = (message: string, step: GitStep): unknown =>
    options.logger?.log(message, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
    });

  logProgress(GitStep.PrepareCloneOnlineWiki);

  logDebug(
    JSON.stringify({
      remoteUrl,
      gitUserName,
      accessToken: truncate(accessToken, {
        length: 24,
      }),
    }),
    GitStep.PrepareCloneOnlineWiki,
  );
  await GitProcess.exec(['init'], dir);
  logProgress(GitStep.StartConfiguringGithubRemoteRepository);
  await credentialOn(dir, remoteUrl, gitUserName, accessToken);
  logProgress(GitStep.StartFetchingFromGithubRemote);
  const defaultBranchName = await getDefaultBranchName(dir);
  const { stderr: pullStdError, exitCode } = await GitProcess.exec(['pull', 'origin', `${defaultBranchName}:${defaultBranchName}`], dir);
  await credentialOff(dir);
  if (exitCode !== 0) {
    throw new GitPullPushError(options, pullStdError);
  } else {
    logProgress(GitStep.SynchronizationFinish);
  }
}
