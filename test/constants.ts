/* eslint-disable security-node/detect-insecure-randomness */
/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable unicorn/prefer-module */
import path from 'path';
import { IGitUserInfos } from '../src/interface';

/**
 * Random dir name to prevent parallel test execution collision
 */
let repoName = Math.random().toString();
/**
 * mockRepoLocation
 */
export let dir: string;
/**
 * Another location to simulate you have two places sync to one upstream repo (Github).
 * Not all test use this, so handle this in each test.
 */
export let dir2: string;
export let upstreamDir: string;

export let gitDirectory: string;
export let upstreamDirGitDirectory: string;
export let gitSyncRepoDirectory: string;
export let gitSyncRepoDirectoryGitDirectory: string;

export const creatorGitInfo: IGitUserInfos & { remote: string } = {
  email: 'gitsync@gmail.com',
  gitUserName: 'linonetwo',
  branch: 'master',
  remote: 'origin',
  accessToken: 'ghp_zA8Xet3mupV6kWj2sFsKUpTv45hJA6ZJyzY6',
};

/**
 * use currentTestName to get better constants, should call in jest functions as early as possible
 */
export const setGlobalConstants = (): void => {
  /**
   * Random dir name to prevent parallel test execution collision
   * This is undefined in describe! Only work inside test block.
   */
  repoName = expect.getState().currentTestName!;
  /**
   * mockRepoLocation
   */
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir = path.join(__dirname, 'mockRepo', repoName);
  dir2 = path.join(__dirname, 'mockRepo2', repoName);
  upstreamDir = path.join(__dirname, 'mockUpstreamRepo', repoName);

  gitDirectory = path.join(dir, '.git');
  upstreamDirGitDirectory = path.join(upstreamDir, '.git');
  gitSyncRepoDirectory = path.join(__dirname, '..');
  gitSyncRepoDirectoryGitDirectory = path.join(gitSyncRepoDirectory, '.git');
};

export const exampleRepoName = 'tiddlygit-test/wiki';
/**
 * In TidGi, we use https remote without `.git` suffix, we will add `.git` when we need it.
 */
export const exampleRemoteUrl = `https://github.com/${exampleRepoName}`;
export const exampleToken = 'testToken';

/** from https://stackoverflow.com/questions/39062595/how-can-i-create-a-png-blob-from-binary-data-in-a-typed-array */
export const exampleImageBuffer = Buffer.from(
  new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    0,
    0,
    0,
    13,
    73,
    72,
    68,
    82,
    0,
    0,
    0,
    8,
    0,
    0,
    0,
    8,
    8,
    2,
    0,
    0,
    0,
    75,
    109,
    41,
    220,
    0,
    0,
    0,
    34,
    73,
    68,
    65,
    84,
    8,
    215,
    99,
    120,
    173,
    168,
    135,
    21,
    49,
    0,
    241,
    255,
    15,
    90,
    104,
    8,
    33,
    129,
    83,
    7,
    97,
    163,
    136,
    214,
    129,
    93,
    2,
    43,
    2,
    0,
    181,
    31,
    90,
    179,
    225,
    252,
    176,
    37,
    0,
    0,
    0,
    0,
    73,
    69,
    78,
    68,
    174,
    66,
    96,
    130,
  ]),
);
