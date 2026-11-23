// The SQLite cache, in memory (the real file is never touched).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openCache } from '../src/cache.ts';

test('remembers a value while it is young enough', () => {
  const cache = openCache(':memory:');
  assert.equal(cache.get('llm:abc', 30), undefined);
  cache.set('llm:abc', '{"results":[]}');
  assert.equal(cache.get('llm:abc', 30), '{"results":[]}');
  assert.equal(cache.get('llm:abc', -1), undefined); // older than allowed
  cache.set('llm:abc', '{"results":[1]}'); // a new answer replaces the old one
  assert.equal(cache.get('llm:abc', 30), '{"results":[1]}');
});
