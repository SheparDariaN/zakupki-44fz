export async function up(db) {
    const collections = await db.listCollections({ name: 'document_states' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('document_states');
    }
    await db.collection('document_states').createIndex({ purchaseId: 1, kind: 1 }, { unique: true });
}

export async function down(db) {
  await db.collection('document_states').drop().catch(() => undefined);
}
