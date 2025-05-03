FROM node:18

# Install Python, pip, FFmpeg, curl
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl

# Install yt-dlp CLI
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install Python dependencies
RUN pip3 install whisper yt_dlp openai

# Install Node dependencies
RUN npm install

# Expose port
EXPOSE 3002

# Start the app
CMD ["node", "app.js"]
