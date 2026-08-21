import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), 'database.json');

let dbInstance: any = null;

class JSONDatabase {
  data: any = { users: [] };

  async init() {
    try {
      const fileData = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(fileData);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        // Create initial database
        await this.save();
      }
    }
    
    // Check if admin exists
    const admin = this.data.users.find((u: any) => u.username === 'admin');
    if (!admin) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      this.data.users.push({
        id: this.getNextId('users'),
        username: 'admin',
        password: hash,
        role: 'admin',
        settings: {}
      });
      await this.save();
      console.log('Default admin user created (admin / admin)');
    }
  }

  async save() {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getNextId(table: string) {
    const records = this.data[table] || [];
    if (records.length === 0) return 1;
    return Math.max(...records.map((r: any) => r.id)) + 1;
  }

  // --- New Methods for Settings and Documents ---

  async getUserSettings(userId: number) {
    const user = this.data.users.find((u: any) => u.id === userId);
    return user?.settings || { customer: '', executorPosition: '', executorName: '' };
  }

  async updateUserSettings(userId: number, settings: any) {
    const user = this.data.users.find((u: any) => u.id === userId);
    if (user) {
      user.settings = { ...user.settings, ...settings };
      await this.save();
    }
  }

  async addDocument(userId: number, name: string, state: any, type: string = 'nmck') {
    if (!this.data.documents) this.data.documents = [];
    const doc = {
      id: this.getNextId('documents'),
      userId,
      name,
      state,
      type,
      createdAt: Date.now()
    };
    this.data.documents.push(doc);
    await this.save();
    return doc;
  }

  async getDocuments(userId: number) {
    if (!this.data.documents) return [];
    
    // 3 days in milliseconds
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    
    // Clean up old documents for all users while we're reading
    this.data.documents = this.data.documents.filter((d: any) => d.createdAt > threeDaysAgo);
    await this.save(); // Save the cleaned up array
    
    return this.data.documents
      .filter((d: any) => d.userId === userId)
      .sort((a: any, b: any) => b.createdAt - a.createdAt);
  }

  // --- Legacy SQL-like simple parsers for auth ---

  async get(query: string, params: any[] = []) {
    // Simple query parser for our basic needs
    if (query.includes('SELECT * FROM users WHERE username = ?')) {
      return this.data.users.find((u: any) => u.username === params[0]);
    }
    return null;
  }

  async all(query: string) {
    if (query.includes('SELECT id, username, role FROM users')) {
      return this.data.users.map((u: any) => ({ id: u.id, username: u.username, role: u.role }));
    }
    return [];
  }

  async run(query: string, params: any[] = []) {
    if (query.includes('INSERT INTO users')) {
      // INSERT INTO users (username, password, role) VALUES (?, ?, ?)
      const existing = this.data.users.find((u: any) => u.username === params[0]);
      if (existing) throw new Error('Username already exists');

      const id = this.getNextId('users');
      this.data.users.push({
        id,
        username: params[0],
        password: params[1],
        role: params[2]
      });
      await this.save();
      return { lastID: id };
    }
    
    if (query.includes('UPDATE users SET password = ? WHERE id = ?')) {
      const user = this.data.users.find((u: any) => u.id === params[1]);
      if (user) {
        user.password = params[0];
        await this.save();
      }
      return { changes: user ? 1 : 0 };
    }

    return {};
  }
}

export async function getDb() {
  if (dbInstance) return dbInstance;
  
  dbInstance = new JSONDatabase();
  await dbInstance.init();

  return dbInstance;
}

