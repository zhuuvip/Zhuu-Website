import { Router } from "express";
import axios from "axios";

const router = Router();

router.post("/wablas", async (req, res) => {
  console.log("WABLAS INBOUND:", JSON.stringify(req.body));
  return res.json({ status: true });
});

router.get("/wablas-test", async (_req, res) => {
  try {
    const token = process.env.WABLAS_API_KEY;
    const secret = process.env.WABLAS_SECRET_KEY;
    const owner = process.env.WABLAS_OWNER;

    if (!token || !secret || !owner) {
      return res.status(500).json({ status: false, message: "Wablas env belum lengkap" });
    }

    const response = await axios.post(
      "https://kudus.wablas.com/api/send-message",
      new URLSearchParams({
        phone: owner,
        message: "Tes notifikasi Zhuu Shop berhasil.",
      }),
      {
        headers: {
          Authorization: `${token}.${secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return res.json(response.data);
  } catch (err: any) {
    return res.status(500).json({
      status: false,
      message: err.response?.data || err.message,
    });
  }
});

export default router;
