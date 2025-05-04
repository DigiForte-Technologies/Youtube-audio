import sys
import subprocess
import os
import time

video_id = sys.argv[1]
video_url = f"https://www.youtube.com/watch?v={video_id}"
cookies_file = "cookies.txt"
mp3_file = f"{video_id}.mp3"
output_template = f"{video_id}.%(ext)s"

MAX_ATTEMPTS = 5
WAIT_SECONDS = 5

success = False

for attempt in range(1, MAX_ATTEMPTS + 1):
    print(f"🔁 Attempt {attempt}/{MAX_ATTEMPTS} downloading {video_id}")
    try:
        result = subprocess.run([
            "yt-dlp",
            "--no-continue",
            "--no-overwrites",
            "--no-part",
            "-x",
            "--audio-format", "mp3",
            "--cookies", cookies_file,
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "-o", output_template,
            video_url
        ], capture_output=True, text=True)

        if result.returncode == 0:
            success = True
            break
        else:
            print(f"⚠️ yt-dlp failed (code {result.returncode}): {result.stderr.strip()}")

    except Exception as e:
        print(f"❌ Exception during download: {str(e)}")

    time.sleep(WAIT_SECONDS * attempt)  # Exponential backoff

if not success or not os.path.exists(mp3_file):
    print("❌ Download failed after retries.", file=sys.stderr)
    sys.exit(1)

# Cleanup: delete temp files except the final mp3
for f in os.listdir():
    if f.startswith(video_id) and f != mp3_file:
        try:
            os.remove(f)
        except:
            pass

# Output the mp3 filename
print(mp3_file)
