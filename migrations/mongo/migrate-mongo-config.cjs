const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI must be set');
}

function databaseNameFromUri(value) {
  if (process.env.MONGODB_DATABASE) return process.env.MONGODB_DATABASE;

  try {
    const parsed = new URL(value);
    const dbName = parsed.pathname.replace(/^\//, '').trim();
    return dbName || 'zakupki';
  } catch {
    return 'zakupki';
  }
}

module.exports = {
  mongodb: {
    url: uri,
    databaseName: databaseNameFromUri(uri),
    options: {},
  },
  migrationsDir: 'migrations/mongo',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'esm',
};
