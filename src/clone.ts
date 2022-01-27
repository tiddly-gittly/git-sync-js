import { GitProcess } from 'dugite';
import { truncate } from 'lodash';
import { credentialOn, credentialOff } from './credential';
import { SyncParameterMissingError, GitPullPushError } from './errors';
import { getRemoteName } from './inspect';
import { IGitUserInfos, ILogger, GitStep } from './interface';
import { defaultGitInfo as defaultDefaultGitInfo } from './defaultGitInfo';
import { initGitWithBranch } from './init';

export async function clone(options: {
  /** wiki folder path, can be relative, should exist before function call */
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
      functionName: 'clone',
      step,
      dir,
      remoteUrl,
    });
  const logDebug = (message: string, step: GitStep): unknown =>
    logger?.debug(message, {
      functionName: 'clone',
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
  logDebug(`Running git init for clone in dir ${dir}`, GitStep.PrepareCloneOnlineWiki);
  await initGitWithBranch(dir, branch, { initialCommit: false });
  const remoteName = await getRemoteName(dir, branch);
  logDebug(`Successfully Running git init for clone in dir ${dir}`, GitStep.PrepareCloneOnlineWiki);
  logProgress(GitStep.StartConfiguringGithubRemoteRepository);
  await credentialOn(dir, remoteUrl, gitUserName, accessToken, remoteName);
  logProgress(GitStep.StartFetchingFromGithubRemote);
  const { stderr: pullStdError, exitCode } = await GitProcess.exec(['pull', remoteName, `${branch}:${branch}`], dir);
  await credentialOff(dir, remoteName, remoteUrl);
  if (exitCode !== 0) {
    throw new GitPullPushError(options, pullStdError);
  } else {
    logProgress(GitStep.SynchronizationFinish);
  }
}
