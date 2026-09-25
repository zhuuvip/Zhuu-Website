import wablasRouter from "./wablas.js";
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
import usageRouter from "./usage.js";
import move2linkRouter from "./move2link.js";
import lootlabsRouter from "./lootlabs.js";
import premiumRouter from "./premium.js";
import resellerRouter from "./reseller.js";
import dripRouter from "./drip.js";
import promosRouter from "./promos.js";

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
router.use(usageRouter);
router.use(move2linkRouter);
router.use(lootlabsRouter);
router.use(premiumRouter);

router.use(walletRouter);
router.use(wablasRouter);
router.use(resellerRouter);
router.use(dripRouter);
router.use(promosRouter);

export default router;
