const { runMigration } = require('./migrate');

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
