import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { getDb, MAX_STATE_BYTES, MIN_PASSWORD_LENGTH } from "./src/server/db";
import { HttpError } from "./src/server/errors";
import { isAuthUser, type AuthUser, type UserRole } from "./src/server/types";
import {
  deletePurchaseFiles,
  deleteStoredFile,
  MAX_CONTRACT_FILE_BYTES,
  MAX_OFFER_FILE_BYTES,
  readStoredFile,
  saveContractFile,
  saveOfferFile,
} from "./src/server/storage/files";

const DEV_JWT_FALLBACK = "your_super_secret_jwt_key_here_change_it_in_prod";
const MAX_USERNAME_LENGTH = 64;
const JSON_BODY_LIMIT = `${Math.ceil((MAX_STATE_BYTES + 32 * 1024) / 1024)}kb`;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const PROD_CSP =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; frame-src 'self' blob:; style-src 'self' 'unsafe-inline'";
const contractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CONTRACT_FILE_BYTES, files: 1 },
});
const offerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_OFFER_FILE_BYTES, files: 1 },
});

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

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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

function getLoginBucket(ip: string, now = Date.now()): RateBucket {
  let bucket = loginAttempts.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, bucket);
  }
  return bucket;
}

function cleanupLoginAttempts(now = Date.now()) {
  if (loginAttempts.size <= 1000) return;
  for (const [key, entry] of loginAttempts) {
    if (now >= entry.resetAt) loginAttempts.delete(key);
  }
}

function recordFailedLogin(req: Request) {
  const now = Date.now();
  const bucket = getLoginBucket(clientIp(req), now);
  bucket.count += 1;
  cleanupLoginAttempts(now);
}

function clearFailedLogins(req: Request) {
  loginAttempts.delete(clientIp(req));
}

function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = getLoginBucket(ip, now);
  if (bucket.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({ error: "Слишком много попыток входа. Попробуйте позже." });
  }
  cleanupLoginAttempts(now);
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

function uploadContractFile(req: Request, res: Response, next: NextFunction) {
  contractUpload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Файл контракта слишком большой" });
      }
      return res.status(400).json({ error: "Некорректная загрузка файла" });
    }
    if (err) return next(err);
    next();
  });
}

function uploadOfferFile(req: Request, res: Response, next: NextFunction) {
  offerUpload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Файл КП слишком большой" });
      }
      return res.status(400).json({ error: "Некорректная загрузка файла" });
    }
    if (err) return next(err);
    next();
  });
}

function contentDispositionForFile(fileName: string, disposition: "attachment" | "inline"): string {
  const asciiName = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_") || "file";
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function contentDispositionForAttachment(fileName: string): string {
  return contentDispositionForFile(fileName, "attachment");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(securityHeaders);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(jsonBodyErrorHandler);

  const db = await getDb();

  app.get("/api/health", async (_req, res) => {
    try {
      const health = await db.health();
      const ok = health.postgres && health.mongo;
      res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "error", ...health });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Требуется авторизация" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err || !isAuthUser(decoded)) {
        return res.status(401).json({ error: "Требуется повторный вход" });
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
      recordFailedLogin(req);
      return res.status(400).json({ error: "Укажите имя пользователя и пароль" });
    }

    try {
      const user = await db.getUserByUsername(username);
      if (!user) {
        recordFailedLogin(req);
        return res.status(400).json({ error: "Неверный логин или пароль" });
      }

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        recordFailedLogin(req);
        return res.status(400).json({ error: "Неверный логин или пароль" });
      }

      clearFailedLogins(req);
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword },
      });
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

  app.get("/api/purchases", authenticateToken, async (req: AuthedRequest, res: Response) => {
    try {
      const purchases = await db.listPurchasesByUser(req.user.id);
      res.json(purchases);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post("/api/purchases", authenticateToken, async (req: AuthedRequest, res: Response) => {
    try {
      const purchase = await db.createPurchase(req.user.id, req.body);
      res.json({ success: true, purchase });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/purchases/:id", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const purchase = await db.getPurchaseById(req.user.id, id);
      if (!purchase) return res.status(404).json({ error: "Закупка не найдена" });
      res.json(purchase);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put("/api/purchases/:id", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const purchase = await db.updatePurchase(req.user.id, id, req.body);
      res.json({ success: true, purchase });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/purchases/:id", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      await db.deletePurchase(req.user.id, id);
      await deletePurchaseFiles(id);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/purchases/:id/context", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const context = await db.getPurchaseContext(req.user.id, id);
      res.json(context);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/purchases/:id/links", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const links = await db.listPurchaseLinks(req.user.id, id);
      res.json(links);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post("/api/purchases/:id/links", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const link = await db.createPurchaseLink(req.user.id, id, req.body);
      res.json({ success: true, link });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put("/api/purchases/:id/links/:linkId", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    const linkId = parseId(req.params.linkId);
    if (id === null || linkId === null) {
      return res.status(400).json({ error: "Некорректный идентификатор ссылки закупки" });
    }

    try {
      const link = await db.updatePurchaseLink(req.user.id, id, linkId, req.body);
      res.json({ success: true, link });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/purchases/:id/links/:linkId", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    const linkId = parseId(req.params.linkId);
    if (id === null || linkId === null) {
      return res.status(400).json({ error: "Некорректный идентификатор ссылки закупки" });
    }

    try {
      await db.deletePurchaseLink(req.user.id, id, linkId);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put("/api/purchases/:id/documents/:kind", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const { state } = req.body as { state?: unknown };
      const document = await db.upsertPurchaseDocumentState(req.user.id, id, req.params.kind, state);
      res.json({ success: true, document });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/purchases/:id/documents/:kind", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const document = await db.getPurchaseDocumentState(req.user.id, id, req.params.kind);
      if (!document) return res.status(404).json({ error: "Документ закупки не найден" });
      res.json(document);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/purchases/:id/documents/:kind", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      await db.deletePurchaseDocumentState(req.user.id, id, req.params.kind);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put(
    "/api/purchases/:id/contract",
    authenticateToken,
    uploadContractFile,
    async (req: AuthedRequest, res: Response) => {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Некорректный идентификатор закупки" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Приложите файл контракта" });
      }

      try {
        const previous = await db.getPurchaseDocumentMetadata(req.user.id, id, "contract");
        const storedFile = await saveContractFile(id, req.file);
        try {
          const document = await db.upsertContractMetadata(req.user.id, id, storedFile);
          if (previous?.fileRelPath && previous.fileRelPath !== storedFile.fileRelPath) {
            await deleteStoredFile(previous.fileRelPath);
          }
          res.json({ success: true, document });
        } catch (err) {
          if (previous?.fileRelPath !== storedFile.fileRelPath) {
            await deleteStoredFile(storedFile.fileRelPath);
          }
          throw err;
        }
      } catch (err) {
        handleApiError(res, err);
      }
    }
  );

  app.get("/api/purchases/:id/contract", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const document = await db.getPurchaseDocumentMetadata(req.user.id, id, "contract");
      if (!document?.fileRelPath || !document.mime || !document.fileName) {
        return res.status(404).json({ error: "Контракт не найден" });
      }
      const file = await readStoredFile(document.fileRelPath);
      res.setHeader("Content-Type", document.mime);
      res.setHeader("Content-Disposition", contentDispositionForAttachment(document.fileName));
      res.send(file);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/purchases/:id/contract", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const previous = await db.deleteContractMetadata(req.user.id, id);
      await deleteStoredFile(previous?.fileRelPath);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/purchases/:id/offers", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор закупки" });
    }

    try {
      const offers = await db.listPurchaseOffers(req.user.id, id);
      res.json(offers);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post(
    "/api/purchases/:id/offers",
    authenticateToken,
    uploadOfferFile,
    async (req: AuthedRequest, res: Response) => {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Некорректный идентификатор закупки" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Приложите файл КП" });
      }

      try {
        const storedFile = await saveOfferFile(id, req.file);
        try {
          const offer = await db.createPurchaseOffer(req.user.id, id, req.body, storedFile);
          res.json({ success: true, offer });
        } catch (err) {
          await deleteStoredFile(storedFile.fileRelPath);
          throw err;
        }
      } catch (err) {
        handleApiError(res, err);
      }
    }
  );

  app.put(
    "/api/purchases/:id/offers/:offerId",
    authenticateToken,
    uploadOfferFile,
    async (req: AuthedRequest, res: Response) => {
      const id = parseId(req.params.id);
      const offerId = parseId(req.params.offerId);
      if (id === null || offerId === null) {
        return res.status(400).json({ error: "Некорректный идентификатор" });
      }

      try {
        const storedFile = req.file ? await saveOfferFile(id, req.file) : undefined;
        try {
          const result = await db.updatePurchaseOffer(req.user.id, id, offerId, req.body, storedFile);
          if (result.previousFileRelPath) {
            await deleteStoredFile(result.previousFileRelPath);
          }
          res.json({ success: true, offer: result.offer });
        } catch (err) {
          if (storedFile) {
            await deleteStoredFile(storedFile.fileRelPath);
          }
          throw err;
        }
      } catch (err) {
        handleApiError(res, err);
      }
    }
  );

  app.get("/api/purchases/:id/offers/:offerId", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    const offerId = parseId(req.params.offerId);
    if (id === null || offerId === null) {
      return res.status(400).json({ error: "Некорректный идентификатор" });
    }

    try {
      const offer = await db.getPurchaseOfferFile(req.user.id, id, offerId);
      const file = await readStoredFile(offer.fileRelPath);
      const download = req.query.download === "1" || req.query.download === "true";
      res.setHeader("Content-Type", offer.mime);
      res.setHeader("Content-Disposition", contentDispositionForFile(offer.fileName, download ? "attachment" : "inline"));
      res.send(file);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/purchases/:id/offers/:offerId", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    const offerId = parseId(req.params.offerId);
    if (id === null || offerId === null) {
      return res.status(400).json({ error: "Некорректный идентификатор" });
    }

    try {
      const previous = await db.deletePurchaseOffer(req.user.id, id, offerId);
      await deleteStoredFile(previous.fileRelPath);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get("/api/counterparties", authenticateToken, async (_req: AuthedRequest, res: Response) => {
    try {
      const counterparties = await db.listCounterparties();
      res.json(counterparties);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post("/api/counterparties", authenticateToken, async (req: AuthedRequest, res: Response) => {
    try {
      const counterparty = await db.createCounterparty(req.body);
      res.json({ success: true, counterparty });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.put("/api/counterparties/:id", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор контрагента" });
    }

    try {
      const counterparty = await db.updateCounterparty(id, req.body);
      res.json({ success: true, counterparty });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/counterparties/:id", authenticateToken, async (req: AuthedRequest, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Некорректный идентификатор контрагента" });
    }

    try {
      await db.deleteCounterparty(id);
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

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
