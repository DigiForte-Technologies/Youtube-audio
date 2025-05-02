import sys
import subprocess
import os
from pathlib import Path

video_id = sys.argv[1]
video_url = f"https://www.youtube.com/watch?v={video_id}"
cookies_file = "cookies.txt"
mp3_file = f"{video_id}.mp3"
compressed_file = f"{video_id}_compressed.mp3"

# Step 1: Download the audio (overwrite silently)
subprocess.run([
    "yt-dlp",
    "--no-continue",
    "--no-overwrites",
    "--no-part",
    "-x",
    "--audio-format", "mp3",
    "--cookies", cookies_file,
    "-o", f"{video_id}.%(ext)s",
    video_url
], check=True)

# Step 2: Compress audio to reduce size under 25MB
subprocess.run([
    "ffmpeg",
    "-y",  # force overwrite
    "-i", mp3_file,
    "-b:a", "48k",  # lower bitrate = smaller file
    "-ar", "16000",  # lower sample rate
    compressed_file
], check=True)

# Step 3: Clean up all files except the compressed one
for f in os.listdir():
    if f.startswith(video_id) and f != f"{video_id}_compressed.mp3":
        try:
            os.remove(f)
        except:
            pass

# Step 4: Output final file path
print(f"{compressed_file}")
