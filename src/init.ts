import { exec } from 'dugite';
import fs from 'fs-extra';
import path from 'path';
import { defaultGitInfo } from './defaultGitInfo';

export interface IGitInitOptions {
  /**
   * Whether create a bare repo, useful as an upstream repo
   */
  bare?: boolean;

  /**
   * Default to true, to try to fix https://stackoverflow.com/questions/12267912/git-error-fatal-ambiguous-argument-head-unknown-revision-or-path-not-in-the
   *
   * Following techniques are not working:
   *
   * ```js
   * await exec(['symbolic-ref', 'HEAD', `refs/heads/${branch}`], dir);
   * await exec(['checkout', `-b`, branch], dir);
   * ```
   *
   * This works:
   * https://stackoverflow.com/a/51527691/4617295
   */
  initialCommit?: boolean;

  /**
   * Git user name for the initial commit
   */
  gitUserName?: string;

  /**
   * Git user email for the initial commit
   */
  email?: string;
}

/**
 * Init and immediately checkout the branch, other wise the branch will be HEAD, which is annoying in the later steps
 */
export async function initGitWithBranch(dir: string, branch = defaultGitInfo.branch, options?: IGitInitOptions): Promise<void> {
  if (options?.bare === true) {
    const bareGitPath = path.join(dir, '.git');
    await fs.mkdirp(bareGitPath);
    await exec(['init', `--initial-branch=${branch}`, '--bare'], bareGitPath);
  } else {
    await exec(['init', `--initial-branch=${branch}`], dir);
  }

  if (options?.initialCommit !== false) {
    const gitUserName = options?.gitUserName ?? defaultGitInfo.gitUserName;
    const email = options?.email ?? defaultGitInfo.email;
    await exec(
      ['commit', `--allow-empty`, '-n', '-m', 'Initial commit when init a new git.'],
      dir,
      {
        env: {
          ...process.env,
          GIT_COMMITTER_NAME: gitUserName,
          GIT_COMMITTER_EMAIL: email,
          GIT_AUTHOR_NAME: gitUserName,
          GIT_AUTHOR_EMAIL: email,
        },
      },
    );
  }
}
