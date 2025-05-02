import sys
import subprocess
import os

video_id = sys.argv[1]
video_url = f"https://www.youtube.com/watch?v={video_id}"
cookies_file = "cookies.txt"
output_template = f"{video_id}.%(ext)s"
mp3_file = f"{video_id}.mp3"

# Step 1: Download the audio
subprocess.run([
    "yt-dlp",
    "-x",
    "--audio-format", "mp3",
    "--cookies", cookies_file,
    "-o", output_template,
    video_url
], check=True)

# Step 2: Create output folder
chunk_folder = f"chunks_{video_id}"
os.makedirs(chunk_folder, exist_ok=True)

## Step 3: Compress audio to reduce size under 25MB
compressed_file = f"{video_id}_compressed.mp3"

subprocess.run([
    "ffmpeg",
    "-i", mp3_file,
    "-b:a", "48k",  # Lower bitrate = smaller file
    "-ar", "16000",  # Lower sample rate
    compressed_file
], check=True)

# Step 4: Output final file path
print(f"{compressed_file}")
