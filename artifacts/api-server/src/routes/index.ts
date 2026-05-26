import { Router, type IRouter } from "express";
import healthRouter from "./health";
import linksRouter from "./links";
import songsRouter from "./songs";
import anthropicRouter from "./anthropic";
import feedbackRouter from "./feedback";
import statsRouter from "./stats";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(linksRouter);
router.use(songsRouter);
router.use(anthropicRouter);
router.use(feedbackRouter);
router.use(statsRouter);
router.use(settingsRouter);

export default router;
