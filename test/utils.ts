import fs from 'fs-extra';
// eslint-disable-next-line unicorn/prevent-abbreviations
import { dir, exampleImageBuffer } from './constants';

export async function addSomeFiles<T extends [string, string]>(location = dir): Promise<T> {
  const paths: T = [`${location}/image.png`, `${location}/test.json`] as T;
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.writeFile(paths[0], exampleImageBuffer);
  await fs.writeJSON(paths[1], { test: 'test' });
  return paths;
}
