/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable unicorn/prefer-module */
import path from 'path';

/**
 * mockRepoLocation
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export const dir = path.join(__dirname, 'mockRepo');

export const gitDirectory = path.join(dir, '.git');
export const gitSyncRepoDirectory = path.join(__dirname, '..');
export const gitSyncRepoDirectoryGitDirectory = path.join(gitSyncRepoDirectory, '.git');

/**
 * In TidGi, we use https remote without `.git` suffix, we will add `.git` when we need it.
 */
export const exampleRemoteUrl = 'https://github.com/tiddly-gittly/git-sync-js';
export const exampleToken = 'testToken';
