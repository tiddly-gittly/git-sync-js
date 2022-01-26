import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import { defaultGitInfo } from '../src/defaultGitInfo';
// eslint-disable-next-line unicorn/prevent-abbreviations
import { dir, exampleImageBuffer, upstreamDir } from './constants';

export async function addSomeFiles<T extends [string, string]>(location = dir): Promise<T> {
  const paths: T = [`${location}/image.png`, `${location}/test.json`] as T;
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.writeFile(paths[0], exampleImageBuffer);
  await fs.writeJSON(paths[1], { test: 'test' });
  return paths;
}

export async function addAnUpstream(): Promise<void> {
  await GitProcess.exec(['remote', 'add', defaultGitInfo.remote, upstreamDir], dir);
  /**
       * Need to fetch the remote repo first, otherwise it will say:
       * 
       * ```
       * % git rev-list --count --left-right origin/main...HEAD        
          fatal: ambiguous argument 'origin/main...HEAD': unknown revision or path not in the working tree.
          Use '--' to separate paths from revisions, like this:
          'git <command> [<revision>...] -- [<file>...]'
       * ```
       */
  await GitProcess.exec(['fetch', defaultGitInfo.remote, defaultGitInfo.branch], dir);
}

export async function addAndCommitUsingDugite(
  location = dir,
  runBetween: () => unknown | Promise<unknown> = () => {},
  message = 'some commit message',
): Promise<void> {
  await GitProcess.exec(['add', '.'], location);
  await runBetween();
  await GitProcess.exec(['commit', '-m', message, `--author="${defaultGitInfo.gitUserName} <${defaultGitInfo.email}>"`], location);
}
