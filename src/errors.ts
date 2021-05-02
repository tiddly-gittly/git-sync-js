import { truncate } from 'lodash';
import { IGitUserInfos } from './interface';

export class AssumeSyncError extends Error {
  constructor(extraMessage?: string) {
    super(extraMessage);
    this.name = 'AssumeSyncError';
    this.message = `E-1 In this state, git should have been sync with the remote, but it is not, this is caused by procedural bug in the git-sync-js. ${
      extraMessage ?? ''
    }`;
  }
}
export class SyncParameterMissingError extends Error {
  constructor(parameterName: string = 'accessToken') {
    super(parameterName);
    this.name = 'SyncParameterMissingError';
    this.message = `E-2 We need ${parameterName} to sync to the cloud, you should pass ${parameterName} as parameters in userInfo.`;
  }
}

export class GitPullPushError extends Error {
  constructor(
    configuration: {
      /** wiki folder path, can be relative */
      dir: string;
      /** the storage service url we are sync to, for example your github repo url */
      remoteUrl?: string;
      /** user info used in the commit message */
      userInfo?: IGitUserInfos;
    },
    extraMessages: string,
  ) {
    super(extraMessages);
    this.name = 'GitPullPushError';
    this.message = `E-3 failed to config git to successfully pull from or push to remote with configuration ${JSON.stringify({
      ...configuration,
      userInfo: {
        ...(configuration.userInfo ?? {}),
        accessToken: truncate(configuration.userInfo?.accessToken, {
          length: 24,
        }),
      },
    })}.\n${extraMessages}`;
  }
}

export class CantSyncGitNotInitializedError extends Error {
  constructor(dir: string) {
    super(dir);
    this.name = 'CantSyncGitNotInitializedError';
    this.message = `E-4 we can't sync on a git repository that is not initialized, maybe this folder is not a git repository. ${dir}`;
  }
}

export class SyncScriptIsInDeadLoopError extends Error {
  constructor() {
    super();
    this.name = 'SyncScriptIsInDeadLoopError';
    this.message = `E-5 Unable to sync, and Sync script is in a dead loop, this is caused by procedural bug in the git-sync-js.`;
  }
}

export class CantSyncInSpecialGitStateAutoFixFailed extends Error {
  constructor(stateMessage: string) {
    super(stateMessage);
    this.name = 'CantSyncInSpecialGitStateAutoFixFailed';
    this.message = `E-6 Unable to Sync, this folder is in special condition, thus can't Sync directly. An auto-fix has been tried, but error still remains. Please resolve all the conflict manually (For example, use VSCode to open the wiki folder), if this still don't work out, please use professional Git tools (Source Tree, GitKraken) to solve this. This is caused by procedural bug in the git-sync-js.\n${stateMessage}`;
  }
}
