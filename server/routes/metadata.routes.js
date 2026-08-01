import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/youtube-duration", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    
    // Look for approximate duration in milliseconds within the ytInitialPlayerResponse JSON embedded in the HTML
    const match = response.data.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
    if (match) {
      const durationMs = parseInt(match[1], 10);
      const durationMinutes = Math.ceil(durationMs / 60000);
      return res.json({ durationMinutes });
    }
    
    // Fallback regex (sometimes it's an integer, not string)
    const matchInt = response.data.match(/"approxDurationMs"\s*:\s*(\d+)/);
    if (matchInt) {
      const durationMs = parseInt(matchInt[1], 10);
      const durationMinutes = Math.ceil(durationMs / 60000);
      return res.json({ durationMinutes });
    }

    res.status(404).json({ error: "Duration not found in page source" });
  } catch (error) {
    console.error("Error fetching YouTube metadata:", error.message);
    res.status(500).json({ error: "Failed to fetch video metadata" });
  }
});

export default router;
