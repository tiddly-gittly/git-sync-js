/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable unicorn/prefer-module */
import path from 'path';

/**
 * mockRepoLocation
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export const dir = path.join(__dirname, 'mockRepo');
export const upstreamDir = path.join(__dirname, 'mockUpstreamRepo');

export const gitDirectory = path.join(dir, '.git');
export const gitSyncRepoDirectory = path.join(__dirname, '..');
export const gitSyncRepoDirectoryGitDirectory = path.join(gitSyncRepoDirectory, '.git');

export const exampleRepoName = 'tiddly-gittly/git-sync-js';
/**
 * In TidGi, we use https remote without `.git` suffix, we will add `.git` when we need it.
 */
export const exampleRemoteUrl = `https://github.com/${exampleRepoName}`;
export const exampleToken = 'testToken';

/** from https://stackoverflow.com/questions/39062595/how-can-i-create-a-png-blob-from-binary-data-in-a-typed-array */
export const exampleImageBuffer = Buffer.from(
  new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 8, 0, 0, 0, 8, 8, 2, 0, 0, 0, 75, 109, 41, 220, 0, 0, 0, 34, 73, 68, 65, 84, 8, 215,
    99, 120, 173, 168, 135, 21, 49, 0, 241, 255, 15, 90, 104, 8, 33, 129, 83, 7, 97, 163, 136, 214, 129, 93, 2, 43, 2, 0, 181, 31, 90, 179, 225, 252, 176, 37,
    0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]),
);
