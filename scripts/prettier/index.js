/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict';

// Based on similar script in Jest
// https://github.com/facebook/jest/blob/a7acc5ae519613647ff2c253dd21933d6f94b47f/scripts/prettier.js

const chalk = require('chalk');
const glob = require('glob');
const prettier = require('prettier');
const fs = require('fs');
const path = require('path');
const listChangedFiles = require('../shared/listChangedFiles');
const prettierConfigPath = require.resolve('../../.prettierrc');

const mode = process.argv[2] || 'check';
const shouldWrite = mode === 'write' || mode === 'write-changed';
const onlyChanged = mode === 'check-changed' || mode === 'write-changed';

// Get list of changed files if onlyChanged mode is enabled
const changedFiles = onlyChanged ? listChangedFiles() : null;

// Read and parse .prettierignore file
const prettierIgnoreFilePath = path.join(__dirname, '..', '..', '.prettierignore');
const prettierIgnoreContent = fs.readFileSync(prettierIgnoreFilePath, 'utf8');
const ignoredPaths = prettierIgnoreContent
  .split('\n')
  .filter(line => !!line && !line.startsWith('#'));

// Convert ignored paths to glob format
const ignoredPathsGlobFormat = ignoredPaths.map(ignoredPath => {
  if (fs.existsSync(ignoredPath) && fs.lstatSync(ignoredPath).isDirectory()) {
    return path.join(ignoredPath, '/**');
  }
  return ignoredPath;
});

// Get list of files to be processed
const files = glob.sync('**/*.js', {
  ignore: [
    '**/node_modules/**',
    '**/cjs/**',
    ...ignoredPathsGlobFormat,
  ],
}).filter(f => !onlyChanged || changedFiles.has(f));

if (!files.length) {
  process.exit(0);
}

async function main() {
  let didWarn = false;
  let didError = false;

  await Promise.all(
    files.map(async file => {
      const options = await prettier.resolveConfig(file, {
        config: prettierConfigPath,
      });

      try {
        const input = fs.readFileSync(file, 'utf8');

        if (shouldWrite) {
          const output = await prettier.format(input, options);
          if (output !== input) {
            fs.writeFileSync(file, output, 'utf8');
          }
        } else {
          const isFormatted = await prettier.check(input, options);
          if (!isFormatted) {
            if (!didWarn) {
              console.log(
                '\n' +
                chalk.red('  This project uses prettier to format all JavaScript code.\n') +
                chalk.dim('    Please run ') +
                chalk.reset('yarn prettier-all') +
                chalk.dim(' and add changes to files listed below to your commit:') +
                '\n\n'
              );
              didWarn = true;
            }
            console.log(file);
          }
        }
      } catch (error) {
        didError = true;
        console.error('\n\n' + error.message);
        console.log(file);
      }
    })
  );

  if (didWarn || didError) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
