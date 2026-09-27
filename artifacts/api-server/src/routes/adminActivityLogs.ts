import { Router } from "express";
import { requireAdmin } from "../lib/auth";
import { getAdminActivityLogs } from "../lib/adminActivityLog";

const router = Router();

router.get("/admin/activity-logs", requireAdmin, async (_req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(_req.query.limit) || 100, 1),
      200,
    );

    const logs = await getAdminActivityLogs(limit);

    return res.json(logs);
  } catch (error) {
    console.error("Get admin activity logs error:", error);
    return res.status(500).json({
      error: "Gagal mengambil activity log",
    });
  }
});

export default router;
