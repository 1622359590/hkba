// Aggregated component definitions. The code registry is the source of truth
// (data-api §2.7); the database only stores searchable synced metadata.

module.exports = [
  ...require('./newsDisplay'),
  ...require('./newsBlocks'),
  ...require('./content'),
  ...require('./association'),
  ...require('./layout'),
];
