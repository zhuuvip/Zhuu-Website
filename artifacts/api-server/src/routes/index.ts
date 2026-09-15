import walletRouter from "./wallet";
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import linksRouter from "./links";
import songsRouter from "./songs";
import anthropicRouter from "./anthropic";
import feedbackRouter from "./feedback";
import statsRouter from "./stats";
import settingsRouter from "./settings";
import ordersRouter from "./orders";

const router: IRouter = Router();

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
