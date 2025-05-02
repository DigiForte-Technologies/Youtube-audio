from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
from pathlib import Path
import sys

video_id = sys.argv[1]

# Proper way to pass cookie file
transcript = YouTubeTranscriptApi.get_transcript(video_id, cookies=Path("cookies.txt"))

formatter = TextFormatter()
print(formatter.format_transcript(transcript))
