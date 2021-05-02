export class AssumeSyncError extends Error {
  constructor(extraMessage?: string) {
    super(extraMessage);
    this.name = 'AssumeSyncError';
    this.message = `E-1 In this state, git should have been sync with the remote, but it is not, this is caused by procedural bug in the git-sync-js. ${
      extraMessage ?? ''
    }`;
  }
}
