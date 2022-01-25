import { GitProcess } from 'dugite';
import { truncate } from 'lodash';
import { credentialOn, credentialOff } from './credential';
import { SyncParameterMissingError, GitPullPushError } from './errors';
import { getDefaultBranchName } from './inspect';
import { IGitUserInfos, ILogger, GitStep } from './interface';
import { defaultGitInfo as defaultDefaultGitInfo } from './defaultGitInfo';

export async function clone(options: {
  /** wiki folder path, can be relative */
  dir: string;
  /** the storage service url we are sync to, for example your github repo url */
  remoteUrl?: string;
  /** user info used in the commit message */
  userInfo?: IGitUserInfos;
  logger?: ILogger;
  defaultGitInfo?: typeof defaultDefaultGitInfo;
}): Promise<void> {
  const { dir, remoteUrl, userInfo, logger, defaultGitInfo = defaultDefaultGitInfo } = options;
  const { gitUserName, branch } = userInfo ?? defaultGitInfo;
  const { accessToken } = userInfo ?? {};

  if (accessToken === '' || accessToken === undefined) {
    throw new SyncParameterMissingError('accessToken');
  }
  if (remoteUrl === '' || remoteUrl === undefined) {
    throw new SyncParameterMissingError('remoteUrl');
  }

  const logProgress = (step: GitStep): unknown =>
    logger?.info(step, {
      functionName: 'commitAndSync',
      step,
      dir,
      remoteUrl,
    });
  const logDebug = (message: string, step: GitStep): unknown =>
    logger?.debug(message, {
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
  logDebug(`Running git init in dir ${dir}`, GitStep.PrepareCloneOnlineWiki);
  await GitProcess.exec(['init'], dir);
  logDebug(`Succefully Running git init in dir ${dir}`, GitStep.PrepareCloneOnlineWiki);
  logProgress(GitStep.StartConfiguringGithubRemoteRepository);
  await credentialOn(dir, remoteUrl, gitUserName, accessToken);
  logProgress(GitStep.StartFetchingFromGithubRemote);
  const defaultBranchName = (await getDefaultBranchName(dir)) ?? branch;
  const { stderr: pullStdError, exitCode } = await GitProcess.exec(['pull', 'origin', `${defaultBranchName}:${defaultBranchName}`], dir);
  await credentialOff(dir, remoteUrl);
  if (exitCode !== 0) {
    throw new GitPullPushError(options, pullStdError);
  } else {
    logProgress(GitStep.SynchronizationFinish);
  }
}
