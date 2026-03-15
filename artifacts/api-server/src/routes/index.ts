import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import conversationsRouter from "./conversations";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(conversationsRouter);
router.use(webhookRouter);

export default router;
