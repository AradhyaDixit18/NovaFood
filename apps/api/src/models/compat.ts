/**
 * The automated test harness can run against FerretDB (a MongoDB wire-compatible server) where
 * a real MongoDB binary is unavailable. FerretDB 1.x has no TTL indexes, so they are skipped
 * there; MongoDB and Atlas always get them.
 *
 * Queries elsewhere also avoid features FerretDB 1.x lacks ($avg, $first, $literal, multiple
 * accumulators in one $group), which keeps every code path exercised by the same tests.
 */
export const supportsTtlIndexes = process.env.MONGO_COMPAT !== 'ferretdb';
