const { initDatabase, getDb, closeDatabase } = require('./init');

const contentTables = ['banners', 'team_members', 'partners', 'news'];

initDatabase();
const db = getDb();
const contentCount = contentTables.reduce((total, table) => {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  return total + row.count;
}, 0);
closeDatabase();

if (contentCount === 0) {
  console.log('Core content is empty; loading initial HKBA content.');
  require('./seed');
} else {
  console.log('Existing HKBA content found; seed skipped.');
}
