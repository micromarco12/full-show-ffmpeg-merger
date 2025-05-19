// Pseudocode sketch — full version below
1. Get list of chapter audio files from Cloudinary (sorted by filename or timestamp)
2. Download them locally
3. Download the swoosh audio file
4. Build a concat list alternating chapter + swoosh (except last)
5. Run FFmpeg to merge them into a final show
6. Use ffprobe to get time durations and generate chapter markers
7. Save chapter timecodes to JSON or TXT
8. Upload final MP3 + timecodes file to Cloudinary
9. Optionally send metadata to Airtable
