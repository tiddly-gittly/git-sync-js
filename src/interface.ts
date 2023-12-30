export interface IGitUserInfos extends IGitUserInfosWithoutToken {
  /** Github Login: token */
  accessToken: string;
}

export interface IGitUserInfosWithoutToken {
  branch: string;
  /** Git commit message email */
  email: string | null | undefined;
  /** Github Login: username , this is also used to filter user's repo when searching repo */
  gitUserName: string;
}

/** custom logger to report progress on each step
 * we don't use logger to report error, we throw errors.
 */
export interface ILogger {
  /** used to report debug logs */
  debug: (message: string, context: ILoggerContext) => unknown;
  /** used to report progress for human user to read */
  info: (message: GitStep, context: ILoggerContext) => unknown;
  /** used to report failed optional progress */
  warn: (message: string, context: ILoggerContext) => unknown;
}
/** context to tell logger which function we are in */
export interface ILoggerContext {
  branch?: string;
  dir?: string;
  functionName: string;
  remoteUrl?: string;
  step: GitStep;
}

export enum GitStep {
  AddComplete = 'AddComplete',
  AddingFiles = 'AddingFiles',
  CantSyncInSpecialGitStateAutoFixSucceed = 'CantSyncInSpecialGitStateAutoFixSucceed',
  CheckingLocalGitRepoSanity = 'CheckingLocalGitRepoSanity',
  CheckingLocalSyncState = 'CheckingLocalSyncState',
  CommitComplete = 'CommitComplete',
  FetchingData = 'FetchingData',
  GitMerge = 'GitMerge',
  GitMergeComplete = 'GitMergeComplete',
  GitMergeFailed = 'GitMergeFailed',
  GitPush = 'GitPush',
  GitPushComplete = 'GitPushComplete',
  GitPushFailed = 'GitPushFailed',
  GitRepositoryConfigurationFinished = 'GitRepositoryConfigurationFinished',
  HaveThingsToCommit = 'HaveThingsToCommit',
  LocalAheadStartUpload = 'LocalAheadStartUpload',
  LocalStateBehindSync = 'LocalStateBehindSync',
  LocalStateDivergeRebase = 'LocalStateDivergeRebase',
  NoNeedToSync = 'NoNeedToSync',
  NoUpstreamCantPush = 'NoUpstreamCantPush',
  PerformLastCheckBeforeSynchronizationFinish = 'PerformLastCheckBeforeSynchronizationFinish',
  PrepareCloneOnlineWiki = 'PrepareCloneOnlineWiki',
  PrepareSync = 'PrepareSync',
  PreparingUserInfo = 'PreparingUserInfo',
  RebaseConflictNeedsResolve = 'RebaseConflictNeedsResolve',
  RebaseResultChecking = 'RebaseResultChecking',
  RebaseSucceed = 'RebaseSucceed',
  StartBackupToGitRemote = 'StartBackupToGitRemote',
  StartConfiguringGithubRemoteRepository = 'StartConfiguringGithubRemoteRepository',
  StartFetchingFromGithubRemote = 'StartFetchingFromGithubRemote',
  StartGitInitialization = 'StartGitInitialization',
  /** this means our algorithm have some problems */
  SyncFailedAlgorithmWrong = 'SyncFailedAlgorithmWrong',
  SynchronizationFinish = 'SynchronizationFinish',
}
/**
 * Steps that indicate we have new files, so we can restart our wiki to reload changes
 */
export const stepsAboutChange = [GitStep.FetchingData, GitStep.LocalStateBehindSync, GitStep.RebaseSucceed];
