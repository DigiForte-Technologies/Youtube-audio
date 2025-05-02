FROM node:18

# Install Python, pip, FFmpeg
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg

# Set working dir
WORKDIR /app

# Copy everything
COPY . .

# Install Python deps
RUN pip3 install whisper yt_dlp openai || true

# Make sure yt-dlp CLI is available
RUN ln -s /usr/local/bin/yt-dlp /usr/bin/yt-dlp || true

# Install Node deps
RUN npm install

# Expose port
EXPOSE 3002

CMD ["node", "app.js"]
