import tidgiConfig from 'eslint-config-tidgi';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  {
    ignores: ['docusaurus.config.ts', 'eslint.config.mjs', 'jest.config.js', 'scripts/**/*.mjs', 'dist/**', 'node_modules/**'],
  },
  ...tidgiConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            './*.js',
            './*.mjs',
            './*.cjs',
            './*.*.js',
            './*.*.ts',
            './*.*.mjs',
            './*.config.ts',
            './*.config.js',
            './*.config.mjs',
            './docusaurus.config.ts',
            './eslint.config.mjs',
            './jest.config.js',
            './scripts/*.mjs',
          ],
        },
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '*.env.d.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      'unicorn/prevent-abbreviations': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
