FROM node:18

# Install Python, pip, FFmpeg, curl
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl

# Install yt-dlp CLI tool
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Create and activate venv
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python deps inside venv
RUN pip install whisper yt_dlp openai

# Set working directory
WORKDIR /app

# Copy app code
COPY . .

# Install Node.js deps
RUN npm install

# Expose port
EXPOSE 3002

# Start the app
CMD ["node", "app.js"]
