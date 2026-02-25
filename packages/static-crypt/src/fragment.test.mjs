// packages/static-crypt/src/fragment.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { parseFragment, buildFragment } from './fragment.mjs';

test('parseFragment extracts tier and key', () => {
  const fragment = '#t=family&k=YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY';
  const { tier, key } = parseFragment(fragment);

  assert.strictEqual(tier, 'family');
  assert.ok(key instanceof Uint8Array);
  assert.strictEqual(key.length, 32);
});

test('parseFragment returns null for missing tier', () => {
  const fragment = '#k=YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY';
  const result = parseFragment(fragment);

  assert.strictEqual(result, null);
});

test('parseFragment returns null for missing key', () => {
  const fragment = '#t=family';
  const result = parseFragment(fragment);

  assert.strictEqual(result, null);
});

test('parseFragment returns null for empty fragment', () => {
  const result = parseFragment('');
  assert.strictEqual(result, null);
});

test('buildFragment creates valid fragment', () => {
  const key = new Uint8Array(32).fill(65); // 'AAAA...'
  const fragment = buildFragment('family', key);

  assert.ok(fragment.startsWith('#t=family&k='));

  // Round-trip
  const parsed = parseFragment(fragment);
  assert.strictEqual(parsed.tier, 'family');
  assert.deepStrictEqual(parsed.key, key);
});
