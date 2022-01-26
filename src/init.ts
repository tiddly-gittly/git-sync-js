import { compact } from 'lodash';
/* eslint-disable unicorn/prevent-abbreviations */
import { GitProcess } from 'dugite';
import { defaultGitInfo } from './defaultGitInfo';

/**
 * Init and immediately checkout the branch, other wise the branch will be HEAD, which is annoying in the later steps
 */
export async function initGitWithBranch(dir: string, branch = defaultGitInfo.branch, bare = false): Promise<void> {
  await GitProcess.exec(compact(['init', `--initial-branch=${branch}`, bare ? '--bare' : undefined]), dir);
  /**
   * try fix https://stackoverflow.com/questions/12267912/git-error-fatal-ambiguous-argument-head-unknown-revision-or-path-not-in-the
   *
   * Following techniques are not working:
   *
   * ```js
   * await GitProcess.exec(['symbolic-ref', 'HEAD', `refs/heads/${branch}`], dir);
   * await GitProcess.exec(['checkout', `-b`, branch], dir);
   * ```
   *
   * This works:
   * https://stackoverflow.com/a/51527691/4617295
   */
  await GitProcess.exec(['commit', `--allow-empty`, '-n', '-m', 'Initial commit when init a new git.'], dir);
}
