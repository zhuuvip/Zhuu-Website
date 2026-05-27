import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";

import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

/* =========================
   CLERK AUTH
========================= */
app.use(clerkMiddleware());

/* =========================
   ROUTES
========================= */
app.use("/api", router);

export default app;
