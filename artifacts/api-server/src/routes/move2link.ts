import { Router } from "express";

const router = Router();

router.post("/ads/move2link", async (req: any, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const token = process.env.MOVE2LINK_API_TOKEN;

    if (!token) {
      console.error("MOVE2LINK_API_TOKEN belum diset");

      return res.status(500).json({
        error: "Move2Link API belum dikonfigurasi",
      });
    }

    const destinationUrl =
      typeof req.body?.url === "string" && req.body.url.trim()
        ? req.body.url.trim()
        : "https://zhuusite.my.id";

    const response = await fetch(
      "https://api.move2link.com/api/v1/links",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          url: destinationUrl,
        }),
      },
    );

    const data: any = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(
        "Move2Link API error:",
        response.status,
        data,
      );

      return res.status(response.status).json({
        error: "Gagal membuat link Move2Link",
        details: data,
      });
    }

    return res.status(201).json({
      shortLink: data?.data?.short_link ?? null,
    });
  } catch (err) {
    console.error("POST /ads/move2link error:", err);

    return res.status(500).json({
      error: "Gagal menghubungi Move2Link",
    });
  }
});

export default router;
