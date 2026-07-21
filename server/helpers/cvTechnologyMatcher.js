// Recognizes which technologies from the canonical Technology catalog are mentioned in
// a block of free text (a parsed CV). Matching is deterministic keyword/alias matching
// scoped to the catalog — the output is always a subset of the technologies passed in,
// so a CV can never introduce a technology that does not already exist in the app.
//
// Keyed by Technology `slug` (the same slugs seeded in seeder/defaultTechnologies.js).
// Technologies not listed here (e.g. an admin-added custom one) fall back to matching
// their name/slug directly — see fallbackAliases().

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Assorted unicode spaces (nbsp, en/em spaces, zero-width, ideographic, BOM) and dashes
// (hyphen, non-breaking hyphen, figure/en/em dash, horizontal bar, underscore).
const UNICODE_SPACES = /[   -​  　﻿]/g;
const DASHES = /[_‐-―-]+/g;

// Lowercased, delimiter-normalized text used for the alias regexes. Hyphens, underscores
// and slashes collapse to spaces so "react-native" / "react/native" read like "react native";
// dots/plus/hash are preserved because they are part of tech names (node.js, c++, c#).
const normalizeText = (raw) =>
  String(raw || '')
    .toLowerCase()
    .replace(UNICODE_SPACES, ' ')
    .replace(DASHES, ' ')
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Case-preserving variant that keeps list delimiters (, ; | ( ) : /). Used only for the
// ambiguous bare "Go" heuristic, which leans on capitalization + list punctuation.
const normalizeCased = (raw) =>
  String(raw || '')
    .replace(UNICODE_SPACES, ' ')
    .replace(DASHES, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();

// alias -> RegExp. Left boundary rejects a preceding letter/digit so "rust" ≠ "trust".
// Right boundary rejects a following letter (and a digit too, unless the alias ends in a
// symbol like c++ / c# so "c++17" still matches).
const buildAliasRegex = (alias) => {
  const escaped = escapeRegExp(alias);
  const right = /[a-z0-9]$/.test(alias) ? '(?![a-z0-9])' : '(?![a-z])';
  return new RegExp(`(?<![a-z0-9])${escaped}${right}`);
};

// Extra terms beyond a tech's own name that should count as a mention. Deliberately
// conservative: bare, common-word forms ("next", "node", "spring", "ruby") are omitted
// to avoid false positives — the multi-word/suffixed forms below carry the signal.
const TECHNOLOGY_ALIASES = {
  react: ['react', 'react.js', 'reactjs'],
  angular: ['angular', 'angularjs', 'angular.js'],
  'vue-js': ['vue', 'vue.js', 'vuejs'],
  'next-js': ['next.js', 'nextjs', 'next js'],
  svelte: ['svelte', 'sveltekit', 'svelte kit'],
  'node-js': ['node.js', 'nodejs', 'node js'],
  'spring-boot': ['spring boot', 'springboot', 'spring framework', 'spring mvc'],
  dotnet: ['.net', 'dotnet', 'dot net', 'asp.net', 'asp.net core', '.net core'],
  django: ['django'],
  fastapi: ['fastapi', 'fast api'],
  laravel: ['laravel'],
  'ruby-on-rails': ['ruby on rails', 'rails', 'ror'],
  kotlin: ['kotlin'],
  swift: ['swift', 'swiftui', 'swift ui'],
  'react-native': ['react native', 'reactnative'],
  flutter: ['flutter'],
  'data-engineering': ['data engineering', 'data engineer'],
  'data-science': ['data science', 'data scientist'],
  'machine-learning': ['machine learning', 'ml', 'deep learning'],
  'manual-qa': ['manual qa', 'manual testing', 'manual tester'],
  'test-automation': [
    'test automation',
    'automation testing',
    'automated testing',
    'qa automation',
    'sdet',
  ],
  devops: ['devops', 'dev ops'],
  cpp: ['c++', 'cpp'],
  rust: ['rust'],
};

// Precompile the known aliases once.
const COMPILED_ALIASES = Object.fromEntries(
  Object.entries(TECHNOLOGY_ALIASES).map(([slug, aliases]) => [slug, aliases.map(buildAliasRegex)])
);

// "Go" is an everyday English word ("ready to go", "on the go"), so bare matching would be
// noisy. Accept the unambiguous "golang" forms, or a capitalized "Go"/"GO" sitting next to
// a list delimiter — the shape of a skills list ("Languages: Go, Rust", "Java | Go"), not prose.
const GO_GOLANG = /(?<![a-z0-9])golang(?![a-z0-9])/;
const GO_GO_LANG = /(?<![a-z0-9])go\s+lang(?![a-z0-9])/;
const GO_LIST_BEFORE = /[,;|/(:]\s*(?:Go|GO)(?![A-Za-z0-9])/;
const GO_LIST_AFTER = /(?<![A-Za-z0-9])(?:Go|GO)\s*(?=[,;|/)])/;

const SPECIAL_MATCHERS = {
  go: (lowerText, casedText) =>
    GO_GOLANG.test(lowerText) ||
    GO_GO_LANG.test(lowerText) ||
    GO_LIST_BEFORE.test(casedText) ||
    GO_LIST_AFTER.test(casedText),
};

// For technologies with no curated entry (e.g. admin-added), match the name and slug directly.
const fallbackAliases = (tech) => {
  const aliases = new Set();
  const name = normalizeText(tech.name || '');
  const slug = normalizeText(tech.slug || '');
  if (name.length >= 2) aliases.add(name);
  if (slug.length >= 2 && slug !== name) aliases.add(slug);
  return [...aliases];
};

// Given raw CV text and the technology catalog, return the subset of technologies mentioned.
// Preserves the input order and objects (so callers keep _id/name/slug). Inactive technologies
// are ignored.
const matchTechnologiesInText = (rawText, technologies = []) => {
  const lowerText = normalizeText(rawText);
  if (!lowerText) return [];
  const casedText = normalizeCased(rawText);

  const matched = [];
  for (const tech of technologies) {
    if (!tech || tech.isActive === false) continue;
    const slug = String(tech.slug || '').toLowerCase();

    const special = SPECIAL_MATCHERS[slug];
    if (special) {
      if (special(lowerText, casedText)) matched.push(tech);
      continue;
    }

    const regexes = COMPILED_ALIASES[slug] || fallbackAliases(tech).map(buildAliasRegex);
    if (regexes.some((rx) => rx.test(lowerText))) matched.push(tech);
  }

  return matched;
};

module.exports = {
  matchTechnologiesInText,
  normalizeText,
  TECHNOLOGY_ALIASES,
};
