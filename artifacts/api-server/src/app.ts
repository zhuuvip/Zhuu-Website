import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";

import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();

/* =========================
   LOGGER
========================= */
app.use(
  (pinoHttp as any)({
    logger,
    autoLogging: true,
  })
);

/* =========================
   CORS
========================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "8mb" }));

/* =========================
   CLERK AUTH
========================= */
app.use(clerkMiddleware());

/* =========================
   ROUTES
========================= */
app.use("/api", router);

/* =========================
   ERROR HANDLER
   Body JSON rusak / terlalu besar, dsb. dibalas JSON (bukan halaman HTML Express).
========================= */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  const status = Number(err?.status ?? err?.statusCode) || 500;
  const code = status >= 400 && status < 600 ? status : 500;

  (req as any).log?.error?.(err);

  res.status(code).json({
    error:
      code === 413
        ? "Ukuran data terlalu besar."
        : code < 500
          ? "Request tidak valid."
          : "Internal server error",
  });
});

export default app;
