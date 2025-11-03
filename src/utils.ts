import type { IGitResult, IGitStringResult } from 'dugite';

export const getGitUrlWithGitSuffix = (url: string): string => `${url}.git`;
export const getGitUrlWithOutGitSuffix = (url: string): string => url.replace(/\.git$/, '');

export const toGitOutputString = (value: string | Buffer): string => (typeof value === 'string' ? value : value.toString('utf8'));

export const toGitStringResult = (result: IGitResult): IGitStringResult => ({
  ...result,
  stdout: toGitOutputString(result.stdout),
  stderr: toGitOutputString(result.stderr),
});
