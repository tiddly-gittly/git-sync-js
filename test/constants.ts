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
