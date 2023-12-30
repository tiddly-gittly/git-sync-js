# git-sync-js

[Documentation Site](https://tiddly-gittly.github.io/git-sync-js/)

JS implementation for [Git-Sync](https://github.com/simonthum/git-sync), a handy script that backup your notes in a git repo to the remote git services.

Used by OpenSource free bi-link second brain note taking & knowledge map app [TidGi-Desktop](https://github.com/tiddly-gittly/TidGi-Desktop), refactor out to be a npm package.

```shell
npm i git-sync-js
```

## Major Functions

There are three major functions: `initGit, clone, commitAndSync`, but you may import other helper functions and Error types, and GitStep types:

```ts
import {
  initGit,
  clone,
  commitAndSync,
  AssumeSyncError,
  CantSyncGitNotInitializedError,
  CantSyncInSpecialGitStateAutoFixFailed,
  getModifiedFileList,
  getRemoteUrl,
  GitPullPushError,
  GitStep,
  ILoggerContext,
  ModifiedFileList,
  SyncParameterMissingError,
  SyncScriptIsInDeadLoopError,
} from 'git-sync-js';
```

See [api docs](./docs/api/) for full list of them.

You can see [TidGi-Desktop's usage](https://github.com/tiddly-gittly/TidGi-Desktop/blob/9e73bbf96deb5a4c085bbf9c56dc38e62efdd550/src/services/git/gitWorker.ts) for full example.

### initGit

[initGit()](./docs/api/modules/initGit.md) Initialize a new `.git` on a folder. If set `syncImmediately` to `true`, it will push local git to remote immediately after init, you should provide `userInfo.accessToken` and `remoteUrl`, otherwise they are optional.

```ts
try {
  await initGit({
    dir: wikiFolderPath,
    remoteUrl,
    syncImmediately: isSyncedWiki,
    userInfo: { ...defaultGitInfo, ...userInfo },
    logger: {
      log: (message: string, context: ILoggerContext): unknown =>
        logger.info(message, { callerFunction: 'initWikiGit', ...context }),
      warn: (message: string, context: ILoggerContext): unknown =>
        logger.warn(message, { callerFunction: 'initWikiGit', ...context }),
      info: (message: GitStep, context: ILoggerContext): void => {
        logger.notice(this.translateMessage(message), {
          handler: WikiChannel.syncProgress,
          callerFunction: 'initWikiGit',
          ...context,
        });
      },
    },
  });
} catch (error) {
  this.translateErrorMessage(error);
}
```

### commitAndSync

[commitAndSync()](./docs/api/modules/commitAndSync.md) is the Core feature of git-sync, commit all unstaged files, and try rebase on remote, and push to the remote.

```ts
try {
  await commitAndSync({
    dir: wikiFolderPath,
    remoteUrl,
    userInfo: { ...defaultGitInfo, ...userInfo },
    logger: {
      log: (message: string, context: ILoggerContext): unknown =>
        logger.info(message, { callerFunction: 'commitAndSync', ...context }),
      warn: (message: string, context: ILoggerContext): unknown =>
        logger.warn(message, { callerFunction: 'commitAndSync', ...context }),
      info: (message: GitStep, context: ILoggerContext): void => {
        logger.notice(this.translateMessage(message), {
          handler: WikiChannel.syncProgress,
          callerFunction: 'commitAndSync',
          ...context,
        });
      },
    },
    filesToIgnore,
  });
} catch (error) {
  this.translateErrorMessage(error);
}
```

### clone

[clone()](./docs/api/modules/clone.md) will Clone a remote repo to a local location.

```ts
try {
  await clone({
    dir: repoFolderPath,
    remoteUrl,
    userInfo: { ...defaultGitInfo, ...userInfo },
    logger: {
      log: (message: string, context: ILoggerContext): unknown =>
        logger.info(message, { callerFunction: 'clone', ...context }),
      warn: (message: string, context: ILoggerContext): unknown =>
        logger.warn(message, { callerFunction: 'clone', ...context }),
      info: (message: GitStep, context: ILoggerContext): void => {
        logger.notice(this.translateMessage(message), {
          handler: WikiChannel.syncProgress,
          callerFunction: 'clone',
          ...context,
        });
      },
    },
  });
} catch (error) {
  this.translateErrorMessage(error);
}
```

## Inspect helpers

### getModifiedFileList

Get modified files and modify type in a folder

```ts
await getModifiedFileList(wikiFolderPath);
```

### getRemoteUrl

Inspect git's remote url from folder's .git config

```ts
export async function credentialOff(directory: string, remoteUrl?: string): Promise<void> {
  const githubRepoUrl = remoteUrl ?? (await getRemoteUrl(directory));
  const gitUrlWithOutCredential = getGitUrlWithOutCredential(githubRepoUrl);
  await GitProcess.exec(['remote', 'set-url', 'origin', gitUrlWithOutCredential], directory);
}
```

### getRemoteRepoName

get the Github Repo Name, which is similar to "linonetwo/wiki", that is the string after "https://github.com/", so we basically just get the pathname of URL.

### haveLocalChanges

See if there is any file not being committed

```ts
if (await haveLocalChanges(dir)) {
  // ... do commit and push
```

### getDefaultBranchName

### getSyncState

### assumeSync

### getGitRepositoryState

### getGitDirectory

### hasGit

Check if dir has `.git`.

## Sync helpers

### commitFiles

### continueRebase

## Steps

These is a git sync steps enum [GitStep](./docs/api/enums/interface.GitStep.md), that will log to logger when steps happened. You can write switch case on them in your custom logger, and translate them into user readable info.

```shell
StartGitInitialization
PrepareCloneOnlineWiki
GitRepositoryConfigurationFinished
StartConfiguringGithubRemoteRepository
StartBackupToGitRemote
PrepareSync
HaveThingsToCommit
AddingFiles
AddComplete
CommitComplete
PreparingUserInfo
FetchingData
NoNeedToSync
LocalAheadStartUpload
CheckingLocalSyncState
CheckingLocalGitRepoSanity
LocalStateBehindSync
LocalStateDivergeRebase
RebaseResultChecking
RebaseConflictNeedsResolve
RebaseSucceed
GitPushFailed
GitMergeFailed
SyncFailedAlgorithmWrong
PerformLastCheckBeforeSynchronizationFinish
SynchronizationFinish
StartFetchingFromGithubRemote
CantSyncInSpecialGitStateAutoFixSucceed
```

## Errors

These are the errors like [AssumeSyncError](./docs/api/classes/errors.AssumeSyncError.md) that will throw on git sync gets into fatal situations. You can try catch on major functions to get these errors, and `instanceof` these error to translate their message for user to read and report.

```shell
AssumeSyncError
SyncParameterMissingError
GitPullPushError
CantSyncGitNotInitializedError
SyncScriptIsInDeadLoopError
CantSyncInSpecialGitStateAutoFixFailed
```
