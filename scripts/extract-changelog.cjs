// Extracts the changelog section for a given version from CHANGELOG.txt and prints it to stdout.

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/extract-changelog.cjs <version>');
  process.exit(1);
}

const changelogPath = join(__dirname, '..', 'CHANGELOG.txt');
const changelog = readFileSync(changelogPath, 'utf8');
const heading = `## [${version}]`;
const headingIndex = changelog.indexOf(heading);

if (headingIndex === -1) {
  console.error(
    `No changelog entry found for version ${version} (expected a "${heading}" heading in CHANGELOG.txt).`,
  );
  process.exit(1);
}

const afterHeading = changelog.slice(headingIndex);
const nextHeadingIndex = afterHeading.slice(heading.length).search(/^## \[/m);
const section =
  nextHeadingIndex === -1 ? afterHeading : afterHeading.slice(0, heading.length + nextHeadingIndex);

process.stdout.write(section.trim() + '\n');
