import { Router } from "express";
import { getAuth } from "@clerk/express";
import { consumeDailyLimit, getDailyLimit } from "../lib/dailyLimits.js";

const router = Router();

async function requireAuth(req: any, res: any) {
  const userId = getAuth(req)?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return userId;
}

router.get("/usage", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const limits = await getDailyLimit(userId);

    return res.json(limits);
  } catch (err) {
    console.error("GET /usage error:", err);
    return res.status(500).json({ error: "Gagal mengambil limit harian" });
  }
});

router.post("/usage/consume", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const type = req.body?.type;

    if (type !== "ai" && type !== "tools") {
      return res.status(400).json({
        error: "Type limit tidak valid",
      });
    }

    const result = await consumeDailyLimit(userId, type);

    if (!result.allowed) {
      return res.status(429).json({
        error:
          type === "ai"
            ? "Limit AI harian kamu sudah habis."
            : "Limit Tools harian kamu sudah habis.",
        ...result,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("POST /usage/consume error:", err);
    return res.status(500).json({
      error: "Gagal menggunakan limit harian",
    });
  }
});

export default router;
