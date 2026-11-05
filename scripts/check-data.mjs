#!/usr/bin/env node
// Fails the build if any data file holds something that looks like an email or a phone number.
// This repository is deployed to GitHub. Personal details belong on the phone, not in these files.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findContactPatterns } from '../src/logic/contactPatterns.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIRS = ['src/data', 'public'];
const DATA_EXTENSIONS = /\.(json|ts|tsx|js|mjs|txt|md|csv|svg|webmanifest)$/i;

/**
 * Add an exact string here only for a public number that belongs in general guidance.
 * Never add a personal number or address.
 */
export const ALLOWED = new Set([]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (DATA_EXTENSIONS.test(name)) yield path;
  }
}

/** @returns {{ file: string, line: number, type: string }[]} Matched text is left out so the log can't repeat it. */
export function scanDataFiles(root = ROOT, dirs = DATA_DIRS) {
  const problems = [];
  for (const dir of dirs) {
    for (const path of walk(join(root, dir))) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((text, i) => {
          for (const { type, match } of findContactPatterns(text)) {
            if (!ALLOWED.has(match)) problems.push({ file: relative(root, path), line: i + 1, type });
          }
        });
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = scanDataFiles();
  if (problems.length) {
    console.error('Data safety check failed. Remove these before building:');
    for (const p of problems) console.error(`  ${p.file}:${p.line} looks like a ${p.type}`);
    process.exit(1);
  }
  console.log('Data safety check passed: no email or phone patterns in data files.');
}
