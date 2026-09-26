import { describe, expect, it } from 'vitest';
import { explainMongoError } from '../src/config/db';

describe('explainMongoError', () => {
  it('points at the Atlas database user for a bad password', () => {
    const msg = explainMongoError(Object.assign(new Error('bad auth : authentication failed'), { code: 8000, codeName: 'AtlasError' }));
    expect(msg).toMatch(/Database Access/);
    expect(msg).toMatch(/%40/);
  });
  it('points at Network Access when no server is reachable', () => {
    expect(explainMongoError(Object.assign(new Error('Could not connect to any servers in your MongoDB Atlas cluster'), { name: 'MongoServerSelectionError' }))).toMatch(/Network Access/);
  });
  it('never echoes a connection string', () => {
    expect(explainMongoError(new Error('querySrv ENOTFOUND _mongodb._tcp.x.mongodb.net'))).not.toMatch(/mongodb\+srv:\/\//);
  });
});
