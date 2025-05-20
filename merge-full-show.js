const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("cloudinary").v2;
const { exec } = require("child_process");
const path = require("path");
const router = express.Router();
const config = require("./settings.json");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: Download file
const downloadFile = async (url, outputPath) => {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

// Helper: Get duration of file
const getAudioDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    exec(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      (err, stdout) => {
        if (err) return reject(err);
        resolve(parseFloat(stdout));
      }
    );
  });
};

router.post("/merge-full-show", async (req, res) => {
  console.log("📦 [DEBUG] Incoming merge-full-show request:", req.body);

  try {
    const { programSlug, chapterFolder, swooshUrl } = req.body;

    if (!programSlug || !chapterFolder || !swooshUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // STEP 1: Get all chapter files from Cloudinary
    const { resources } = await cloudinary.search
      .expression(`folder=${chapterFolder}`)
      .sort_by("public_id", "asc")
      .max_results(100)
      .execute();

    console.log("📦 [DEBUG] Resources found:", resources.length);

    const audioFiles = resources
      .filter((r) => r.resource_type === "video" || r.format === "mp3")
      .map((r) => ({
        url: r.secure_url,
        name: path.basename(r.public_id),
      }));

    if (audioFiles.length === 0) {
      console.log("⚠️ [DEBUG] No valid MP3 files found in folder.");
      return res.status(404).json({ error: "No chapters found." });
    }

    // STEP 2: Download all audio files and swoosh
    const tempFolder = path.join(__dirname, "temp", uuidv4());
    fs.mkdirSync(tempFolder, { recursive: true });

    const swooshPath = path.join(tempFolder, "swoosh.mp3");
    await downloadFile(swooshUrl, swooshPath);

    const localFiles = [];
    for (let i = 0; i < audioFiles.length; i++) {
      const localPath = path.join(tempFolder, `chapter${i + 1}.mp3`);
      await downloadFile(audioFiles[i].url, localPath);
      localFiles.push({ path: localPath, name: audioFiles[i].name });
    }

    // STEP 3: Build concat list and track chapters
    const concatListPath = path.join(tempFolder, "concat.txt");
    const chapterMarkers = [];
    let cumulativeTime = 0;

    const concatLines = [];

    for (let i = 0; i < localFiles.length; i++) {
      if (i > 0) {
        concatLines.push(`file '${swooshPath}'`);
        const swooshDur = await getAudioDuration(swooshPath);
        cumulativeTime += swooshDur;
      }

      // Chapter marker should start at the swoosh (or 0 for first)
      chapterMarkers.push({
        chapter: `Chapter ${i + 1}`,
        file: localFiles[i].name,
        startTime: cumulativeTime,
      });

      concatLines.push(`file '${localFiles[i].path}'`);
      const duration = await getAudioDuration(localFiles[i].path);
      cumulativeTime += duration;
    }

    fs.writeFileSync(concatListPath, concatLines.join("\n"));

    // STEP 4: Merge with FFmpeg
    const outputPath = path.join(tempFolder, "full-show.mp3");
    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // STEP 5: Upload full audio and chapters JSON
const cloudinaryFolder = `${programSlug}/Full-Show`;
const publicId = `${cloudinaryFolder}/full-show`; // no .mp3 here

const upload = await cloudinary.uploader.upload(outputPath, {
  resource_type: "video",
  folder: `${programSlug}/Full-Show`,
  public_id: "full-show",
  format: "mp3",
  overwrite: true,
});

    const chapterJsonPath = path.join(tempFolder, "chapters.json");
    fs.writeFileSync(chapterJsonPath, JSON.stringify(chapterMarkers, null, 2));

    await cloudinary.uploader.upload(chapterJsonPath, {
      resource_type: "raw",
      public_id: `${cloudinaryFolder}/chapters`,
      overwrite: true,
    });

    // Clean up
    fs.rmSync(tempFolder, { recursive: true, force: true });

    console.log("✅ [DEBUG] Merge complete. File uploaded to:", upload.secure_url);

    res.json({
      message: "Full show created!",
      audioUrl: upload.secure_url,
      chapters: chapterMarkers,
    });
  } catch (err) {
    console.error("[MERGE ERROR]", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

module.exports = router;
