import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb, MAX_STATE_BYTES, MIN_PASSWORD_LENGTH } from "./src/server/db";
import { HttpError } from "./src/server/errors";
import { isAuthUser, type AuthUser, type UserRole } from "./src/server/types";

const DEV_JWT_FALLBACK = "your_super_secret_jwt_key_here_change_it_in_prod";
const MAX_USERNAME_LENGTH = 64;
const JSON_BODY_LIMIT = `${Math.ceil((MAX_STATE_BYTES + 32 * 1024) / 1024)}kb`;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const PROD_CSP =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'";

type RateBucket = { count: number; resetAt: number };
const loginAttempts = new Map<string, RateBucket>();

type AuthedRequest = Request & { user: AuthUser };

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return DEV_JWT_FALLBACK;
}

const JWT_SECRET = resolveJwtSecret();

function handleApiError(res: Response, err: unknown) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
}

function parseUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_USERNAME_LENGTH) return null;
  return trimmed;
}

function parseRole(value: unknown): UserRole | null {
  if (value === undefined || value === null || value === "") return "user";
  if (value === "admin" || value === "user") return value;
  return null;
}

function clientIp(req: Request): string {
  return req.socket.remoteAddress || "unknown";
}

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Content-Security-Policy", PROD_CSP);
  }
  next();
}

function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = clientIp(req);
  const now = Date.now();
  let bucket = loginAttempts.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > LOGIN_MAX_ATTEMPTS) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({ error: "Слишком много попыток входа. Попробуйте позже." });
  }
  if (loginAttempts.size > 1000) {
    for (const [key, entry] of loginAttempts) {
      if (now >= entry.resetAt) loginAttempts.delete(key);
    }
  }
  next();
}

function jsonBodyErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err && typeof err === "object" && "type" in err && (err as { type?: string }).type === "entity.too.large") {
    return res.status(413).json({ error: "Слишком большой запрос" });
  }
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: "Некорректный JSON" });
  }
  next(err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(securityHeaders);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(jsonBodyErrorHandler);

  const db = await getDb();

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Требуется авторизация" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err || !isAuthUser(decoded)) {
        return res.status(403).json({ error: "Доступ запрещён" });
      }
      req.user = decoded;
      next();
    });
  };

  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Доступ запрещён" });
    }
    next();
  };

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    const { username, password } = req.body as { username?: unknown; password?: unknown };
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return res.status(400).json({ error: "Укажите имя пользователя и пароль" });
    }

    try {
      const user = await db.getUserByUsername(username);
      if (!user) return res.status(400).json({ error: "Неверный логин или пароль" });

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) return res.status(400).json({ error: "Неверный логин или пароль" });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const { newPassword } = req.body as { newPassword?: unknown };
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: "Пароль должен содержать не менее 5 символов" });
    }

    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(newPassword, salt);
      await db.updateUserPassword(req.user.id, hash);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/users", authenticateToken, isAdmin, async (_req: AuthedRequest, res: Response) => {
    try {
      const users = await db.listUsers();
      res.json(users);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post("/api/users", authenticateToken, isAdmin, async (req: AuthedRequest, res: Response) => {
    const { username, password, role } = req.body as {
      username?: unknown;
      password?: unknown;
      role?: unknown;
    };
    const parsedUsername = parseUsername(username);
    if (!parsedUsername || typeof password !== "string") {
      return res.status(400).json({ error: "Заполните обязательные поля" });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: "Пароль должен содержать не менее 5 символов" });
    }
    const parsedRole = parseRole(role);
    if (!parsedRole) {
      return res.status(400).json({ error: "Роль должна быть admin или user" });
    }

    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      const result = await db.createUser(parsedUsername, hash, parsedRole);
      res.json({ success: true, id: result.lastID });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/user/settings", authenticateToken, async (req: AuthedRequest, res: Response) => {
    try {
      const settings = await db.getUserSettings(req.user.id);
      res.json(settings);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post("/api/user/settings", authenticateToken, async (req: AuthedRequest, res: Response) => {
    try {
      await db.updateUserSettings(req.user.id, req.body);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/user/documents", authenticateToken, async (req: AuthedRequest, res: Response) => {
    try {
      const docs = await db.getDocuments(req.user.id);
      res.json(docs);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post("/api/user/documents", authenticateToken, async (req: AuthedRequest, res: Response) => {
    try {
      const { name, state, type } = req.body as { name?: unknown; state?: unknown; type?: unknown };
      await db.addDocument(req.user.id, name, state, type);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
