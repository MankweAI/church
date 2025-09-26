// =================================================================
// FINAL MVP: AUDIO-ONLY SERVER (server.js)
// =================================================================

// -----------------------------------------------------------------
// 1. SETUP & IMPORTS
// -----------------------------------------------------------------
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const YtDlpWrap = require("yt-dlp-wrap").default;
const ffmpeg = require("fluent-ffmpeg");

// Explicitly set the path to the FFmpeg executable for fluent-ffmpeg
ffmpeg.setFfmpegPath("C:\\FFmpeg\\bin\\ffmpeg.exe");

// Initialize our core tools
const app = express();
const ytDlp = new YtDlpWrap();
const PORT = 3000;

// Helper function to convert time strings (e.g., "MM:SS") to seconds
const timeToSeconds = (time) => {
  const parts = time.split(":").map(Number);
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return Number(time) || 0; // Return 0 if format is invalid
};

// -----------------------------------------------------------------
// 2. MIDDLEWARE
// -----------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/output", express.static(path.join(__dirname, "output")));

// -----------------------------------------------------------------
// 3. API ENDPOINT (AUDIO-ONLY)
// -----------------------------------------------------------------
app.post("/process-video", async (req, res) => {
  console.log("---------------------------------");
  console.log("Received a request for an audio clip.");

  const { url, startTime, endTime } = req.body;
  const format = "mp3";

  if (!url || !startTime || !endTime) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required parameters." });
  }

  console.log(`Params: URL=${url}, Start=${startTime}, End=${endTime}`);

  const outputDir = path.join(__dirname, "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // yt-dlp will download the audio, so we give it a generic temp name
  const tempFilePath = path.join(__dirname, `temp_audio_${Date.now()}`);
  const outputFileName = `nugget_${Date.now()}.mp3`;
  const outputFilePath = path.join(outputDir, outputFileName);
  const actualTempFilePath = `${tempFilePath}.mp3`;

  try {
    console.log(`[Step 1/3] Starting audio download...`);

    // Command to download and convert the best audio to MP3 directly.
    await ytDlp.execPromise([
      url,
      "-x", // Extract audio
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0", // Best quality
      "-o",
      tempFilePath, // yt-dlp will add the .mp3 extension
    ]);

    if (!fs.existsSync(actualTempFilePath)) {
      throw new Error("Audio download failed, temporary MP3 file not found.");
    }
    console.log(
      `[Step 1/3] Download finished. File saved to: ${actualTempFilePath}`
    );

    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    const durationSeconds = endSeconds - startSeconds;

    if (durationSeconds <= 0) {
      throw new Error("End time must be after start time.");
    }

    console.log(
      `[Step 2/3] Starting FFmpeg to cut audio from ${startSeconds}s for ${durationSeconds}s.`
    );

    ffmpeg(actualTempFilePath)
      .setStartTime(startSeconds)
      .setDuration(durationSeconds)
      .noVideo()
      .audioBitrate("192k")
      .on("progress", (progress) => {
        console.log(
          `[FFmpeg Progress] Processing: ${Math.floor(progress.percent)}% done`
        );
      })
      .on("end", () => {
        console.log("[Step 2/3] FFmpeg processing finished successfully.");
        console.log(`[Step 3/3] Sending response to client.`);
        fs.unlinkSync(actualTempFilePath); // Clean up temp file

        res.json({
          success: true,
          downloadUrl: `/output/${outputFileName}`,
        });
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err.message);
        fs.unlinkSync(actualTempFilePath);
        res
          .status(500)
          .json({
            success: false,
            message: `Failed to process audio. FFmpeg error: ${err.message}`,
          });
      })
      .save(outputFilePath);
  } catch (error) {
    console.error("Error in processing pipeline:", error.message);
    // Clean up any temp file that might exist
    if (fs.existsSync(actualTempFilePath)) {
      fs.unlinkSync(actualTempFilePath);
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// -----------------------------------------------------------------
// 4. START THE SERVER
// -----------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
