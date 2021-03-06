import { GitProcess } from 'dugite';
import { credentialOn, credentialOff } from './credential';
import { SyncParameterMissingError, GitPullPushError, CantSyncGitNotInitializedError } from './errors';
import { assumeSync, getDefaultBranchName, getGitRepositoryState, getRemoteName, getSyncState, haveLocalChanges } from './inspect';
import { IGitUserInfos, ILogger, GitStep } from './interface';
import { defaultGitInfo as defaultDefaultGitInfo } from './defaultGitInfo';
import { commitFiles, continueRebase, mergeUpstream, pushUpstream } from './sync';

export interface ICommitAndSyncOptions {
  /** wiki folder path, can be relative */
  dir: string;
  commitOnly?: boolean;
  /** the storage service url we are sync to, for example your github repo url
   * When empty, and commitOnly===true, it means we just want commit, without sync
   */
  remoteUrl?: string;
  /** user info used in the commit message
   * When empty, and commitOnly===true, it means we just want commit, without sync
   */
  userInfo?: IGitUserInfos;
  /** the commit message */
  commitMessage?: string;
  logger?: ILogger;
  defaultGitInfo?: typeof defaultDefaultGitInfo;
  /** if you want to use a dynamic .gitignore, you can passing an array contains filepaths that want to ignore */
  filesToIgnore?: string[];
}
/**
 * `git add .` + `git commit` + `git rebase` or something that can sync bi-directional
 */
export async function commitAndSync(options: ICommitAndSyncOptions): Promise<void> {
  const {
    dir,
    remoteUrl,
    commitMessage = 'Updated with Git-Sync',
    userInfo,
    logger,
    defaultGitInfo = defaultDefaultGitInfo,
    filesToIgnore,
    commitOnly,
  } = options;
  const { gitUserName, email, branch } = userInfo ?? defaultGitInfo;
  const { accessToken } = userInfo ?? {};

  const defaultBranchName = (await getDefaultBranchName(dir)) ?? branch;
  const remoteName = await getRemoteName(dir, defaultBranchName);

  const logProgress = (step: GitStep): unknown =>
    logger?.info?.(step, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
      branch: defaultBranchName,
    });
  const logDebug = (message: string, step: GitStep): unknown =>
    logger?.debug?.(message, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
      branch: defaultBranchName,
    });
  const logWarn = (message: string, step: GitStep): unknown =>
    logger?.warn?.(message, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
      branch: defaultBranchName,
    });

  // preflight check
  const repoStartingState = await getGitRepositoryState(dir, logger);
  if (repoStartingState.length === 0 || repoStartingState === '|DIRTY') {
    logProgress(GitStep.PrepareSync);
    logDebug(`${dir} repoStartingState: ${repoStartingState}, ${gitUserName} <${email ?? defaultGitInfo.email}>`, GitStep.PrepareSync);
  } else if (repoStartingState === 'NOGIT') {
    throw new CantSyncGitNotInitializedError(dir);
  } else {
    // we may be in middle of a rebase, try fix that
    await continueRebase(dir, gitUserName, email ?? defaultGitInfo.email, logger, repoStartingState);
  }
  if (await haveLocalChanges(dir)) {
    logProgress(GitStep.HaveThingsToCommit);
    logDebug(commitMessage, GitStep.HaveThingsToCommit);
    const { exitCode: commitExitCode, stderr: commitStdError } = await commitFiles(
      dir,
      gitUserName,
      email ?? defaultGitInfo.email,
      commitMessage,
      filesToIgnore,
    );
    if (commitExitCode !== 0) {
      logWarn(`commit failed ${commitStdError}`, GitStep.CommitComplete);
    }
    logProgress(GitStep.CommitComplete);
  }
  if (commitOnly === true) {
    return;
  }
  logProgress(GitStep.PreparingUserInfo);
  if (accessToken === '' || accessToken === undefined) {
    throw new SyncParameterMissingError('accessToken');
  }
  if (remoteUrl === '' || remoteUrl === undefined) {
    throw new SyncParameterMissingError('remoteUrl');
  }
  await credentialOn(dir, remoteUrl, gitUserName, accessToken, remoteName);
  logProgress(GitStep.FetchingData);
  await GitProcess.exec(['fetch', remoteName, defaultBranchName], dir);
  let exitCode = 0;
  let stderr: string | undefined;
  const syncStateAfterCommit = await getSyncState(dir, defaultBranchName, remoteName, logger);
  switch (syncStateAfterCommit) {
    case 'equal': {
      logProgress(GitStep.NoNeedToSync);
      await credentialOff(dir, remoteUrl);
      return;
    }
    case 'noUpstreamOrBareUpstream': {
      logProgress(GitStep.NoUpstreamCantPush);
      // try push, if success, means it is bare, otherwise, it is no upstream
      try {
        await pushUpstream(dir, defaultBranchName, remoteName, logger);
        break;
      } catch (error) {
        logWarn(
          `${JSON.stringify({ dir, remoteUrl, userInfo })}, remoteUrl may be not valid, noUpstreamOrBareUpstream after credentialOn`,
          GitStep.NoUpstreamCantPush,
        );
        throw error;
      }
    }
    case 'ahead': {
      logProgress(GitStep.LocalAheadStartUpload);
      await pushUpstream(dir, defaultBranchName, remoteName, logger);
      break;
    }
    case 'behind': {
      logProgress(GitStep.LocalStateBehindSync);
      await mergeUpstream(dir, defaultBranchName, remoteName, logger);
      break;
    }
    case 'diverged': {
      logProgress(GitStep.LocalStateDivergeRebase);
      ({ exitCode, stderr } = await GitProcess.exec(['rebase', `${remoteName}/${defaultBranchName}`], dir));
      logProgress(GitStep.RebaseResultChecking);
      if (exitCode !== 0) {
        logWarn(`exitCode: ${exitCode}, stderr of git rebase: ${stderr}`, GitStep.RebaseResultChecking);
      }
      if (
        exitCode === 0 &&
        (await getGitRepositoryState(dir, logger)).length === 0 &&
        (await getSyncState(dir, defaultBranchName, remoteName, logger)) === 'ahead'
      ) {
        logProgress(GitStep.RebaseSucceed);
      } else {
        await continueRebase(dir, gitUserName, email ?? defaultGitInfo.email, logger);
        logProgress(GitStep.RebaseConflictNeedsResolve);
      }
      await pushUpstream(dir, defaultBranchName, remoteName, logger);
      break;
    }
    default: {
      logProgress(GitStep.SyncFailedAlgorithmWrong);
    }
  }
  await credentialOff(dir, remoteUrl);
  if (exitCode === 0) {
    logProgress(GitStep.PerformLastCheckBeforeSynchronizationFinish);
    await assumeSync(dir, defaultBranchName, remoteName, logger);
    logProgress(GitStep.SynchronizationFinish);
  } else {
    switch (exitCode) {
      // "message":"exitCode: 128, stderr of git push: fatal: unable to access 'https://github.com/tiddly-gittly/TiddlyWiki-Chinese-Tutorial.git/': LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443 \n"
      case 128: {
        throw new GitPullPushError(options, stderr ?? '');
      }
      // TODO: handle auth expire and throw here
      default: {
        throw new GitPullPushError(options, stderr ?? '');
      }
    }
  }
}
