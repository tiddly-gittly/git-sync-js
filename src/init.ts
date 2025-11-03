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
    await exec(['commit', `--allow-empty`, '-n', '-m', 'Initial commit when init a new git.'], dir);
  }
}
