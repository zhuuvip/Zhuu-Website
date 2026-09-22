import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import { getDripProducts, getDripBalance } from "../lib/dripApi.js";

const router = Router();

router.get("/admin/drip/products", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getDripProducts());
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Gagal mengambil produk DRIP" });
  }
});

router.get("/admin/drip/balance", requireAdmin, async (_req, res) => {
  try {
    return res.json(await getDripBalance());
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Gagal mengambil saldo DRIP" });
  }
});

export default router;

