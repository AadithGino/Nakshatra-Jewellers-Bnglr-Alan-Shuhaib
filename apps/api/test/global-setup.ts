import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const uriFile = resolve(import.meta.dirname, '.vitest-mongo-uri');

export default async function globalSetup() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await replSet.waitUntilRunning();
  writeFileSync(uriFile, replSet.getUri());
  return async () => {
    await replSet.stop();
  };
}
