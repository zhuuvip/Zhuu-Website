import walletRouter from "./wallet.js";
import { Router } from "express";
import healthRouter from "./health.js";
import productsRouter from "./products.js";
import linksRouter from "./links.js";
import songsRouter from "./songs.js";
import anthropicRouter from "./anthropic.js";
import feedbackRouter from "./feedback.js";
import statsRouter from "./stats.js";
import settingsRouter from "./settings.js";
import ordersRouter from "./orders.js";

const router = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(linksRouter);
router.use(songsRouter);
router.use(anthropicRouter);
router.use(feedbackRouter);
router.use(statsRouter);
router.use(settingsRouter);
router.use(ordersRouter);

router.use(walletRouter);

export default router;
