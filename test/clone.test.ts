/* eslint-disable security/detect-non-literal-fs-filename */
import { GitProcess } from 'dugite';
import fs from 'fs-extra';
import { assumeSync, getDefaultBranchName, getSyncState, hasGit, haveLocalChanges, SyncState } from '../src/inspect';
import { defaultGitInfo } from '../src/defaultGitInfo';
import { AssumeSyncError } from '../src/errors';
import {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  dir,
  exampleToken,
  gitDirectory,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  upstreamDir,
} from './constants';
import { addAndCommitUsingDugite, addAnUpstream, addSomeFiles } from './utils';
import { commitFiles } from '../src/sync';
import { clone } from '../src/clone';

describe('clone', () => {
  beforeEach(async () => {
    // remove dir's .git folder in this test suit, so we have a clean folder to clone
    await fs.remove(gitDirectory);
  });

  const testBranchName = 'test-branch';

  describe('with upstream', () => {
    test('equal to upstream that using dugite add', async () => {
      await clone({
        dir,
        defaultGitInfo,
        remoteUrl: upstreamDir,
      });
    });
  });
});
