import { GitProcess } from 'dugite';
import { truncate } from 'lodash';
import { credentialOn, credentialOff } from './credential';
import { SyncParameterMissingError, GitPullPushError } from './errors';
import { initGitWithBranch } from './init';
import { getDefaultBranchName } from './inspect';
import { IGitUserInfosWithoutToken, IGitUserInfos, ILogger, GitStep } from './interface';
import { defaultGitInfo as defaultDefaultGitInfo } from './defaultGitInfo';
import { commitFiles } from './sync';

export type IInitGitOptions = IInitGitOptionsSyncImmediately | IInitGitOptionsNotSync;
export interface IInitGitOptionsSyncImmediately {
  /** wiki folder path, can be relative */
  dir: string;
  /** should we sync after git init? */
  syncImmediately: true;
  /** only required if syncImmediately is true, the storage service url we are sync to, for example your github repo url */
  remoteUrl: string;
  /** user info used in the commit message */
  userInfo: IGitUserInfosWithoutToken & IGitUserInfos;
  logger?: ILogger;
  defaultGitInfo?: typeof defaultDefaultGitInfo;
}
export interface IInitGitOptionsNotSync {
  /** wiki folder path, can be relative */
  dir: string;
  /** should we sync after git init? */
  syncImmediately?: false;
  userInfo?: IGitUserInfosWithoutToken | IGitUserInfos;
  logger?: ILogger;
  defaultGitInfo?: typeof defaultDefaultGitInfo;
}

export async function initGit(options: IInitGitOptions): Promise<void> {
  const { dir, userInfo, syncImmediately, logger, defaultGitInfo = defaultDefaultGitInfo } = options;

  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'initGit',
      step,
    });
  const logDebug = (message: string, step: GitStep): unknown => logger?.debug(message, { functionName: 'initGit', step });

  logProgress(GitStep.StartGitInitialization);
  const { gitUserName, email, branch } = userInfo ?? defaultGitInfo;
  logDebug(`Running git init in dir ${dir}`, GitStep.StartGitInitialization);
  await initGitWithBranch(dir, branch);
  logDebug(`Succefully Running git init in dir ${dir}`, GitStep.StartGitInitialization);
  await commitFiles(dir, gitUserName, email ?? defaultGitInfo.email);

  // if we are config local note git, we are done here
  if (syncImmediately !== true) {
    logProgress(GitStep.GitRepositoryConfigurationFinished);
    return;
  }
  // sync to remote, start config synced note
  if (userInfo === undefined || !('accessToken' in userInfo) || userInfo?.accessToken?.length === 0) {
    throw new SyncParameterMissingError('accessToken');
  }
  const { remoteUrl } = options;
  if (remoteUrl === undefined || remoteUrl.length === 0) {
    throw new SyncParameterMissingError('remoteUrl');
  }
  logDebug(
    `Using gitUrl ${remoteUrl} with gitUserName ${gitUserName} and accessToken ${truncate(userInfo?.accessToken, {
      length: 24,
    })}`,
    GitStep.StartConfiguringGithubRemoteRepository,
  );
  logProgress(GitStep.StartConfiguringGithubRemoteRepository);
  await credentialOn(dir, remoteUrl, gitUserName, userInfo?.accessToken);
  logProgress(GitStep.FetchingData);
  const defaultBranchName = (await getDefaultBranchName(dir)) ?? branch;
  await GitProcess.exec(['fetch', 'origin', defaultBranchName], dir);
  logProgress(GitStep.StartBackupToGitRemote);
  const { stderr: pushStdError, exitCode: pushExitCode } = await GitProcess.exec(['push', 'origin', defaultBranchName], dir);
  await credentialOff(dir, remoteUrl);
  if (pushExitCode !== 0) {
    logProgress(GitStep.GitPushFailed);
    throw new GitPullPushError(options, `branch: ${defaultBranchName} ${pushStdError}`);
  } else {
    logProgress(GitStep.SynchronizationFinish);
  }
}
