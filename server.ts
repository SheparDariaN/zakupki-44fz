import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { getDb } from "./src/server/db";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_here_change_it_in_prod";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Wait for DB initialization
  const db = await getDb();

  // Authentication Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    next();
  };

  // API Routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    try {
      const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
      if (!user) return res.status(400).json({ error: "Invalid credentials" });

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req: any, res: any) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 5) {
      return res.status(400).json({ error: "Password must be at least 5 characters long" });
    }

    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(newPassword, salt);
      await db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin route to list users (basic example for future expansion)
  app.get("/api/users", authenticateToken, isAdmin, async (req: any, res: any) => {
    try {
      const users = await db.all('SELECT id, username, role FROM users');
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin route to create user
  app.post("/api/users", authenticateToken, isAdmin, async (req: any, res: any) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      const result = await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, role || 'user']);
      res.json({ success: true, id: result.lastID });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error or username already exists" });
    }
  });

  // --- Profile Settings Routes ---
  
  app.get("/api/user/settings", authenticateToken, async (req: any, res: any) => {
    try {
      const settings = await db.getUserSettings(req.user.id);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/user/settings", authenticateToken, async (req: any, res: any) => {
    try {
      await db.updateUserSettings(req.user.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // --- Document History Routes ---

  app.get("/api/user/documents", authenticateToken, async (req: any, res: any) => {
    try {
      const docs = await db.getDocuments(req.user.id);
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/user/documents", authenticateToken, async (req: any, res: any) => {
    try {
      const { name, state, type } = req.body;
      await db.addDocument(req.user.id, name, state, type || 'nmck');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
