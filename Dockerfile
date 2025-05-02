# Start with a base Node.js image
FROM node:18

# Install Python and FFmpeg
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install Python dependencies (if you have requirements.txt)
RUN pip3 install whisper yt_dlp openai || true


# Install Node.js dependencies
RUN npm install

# Expose the correct port
EXPOSE 3002

# Start the server
CMD ["node", "app.js"]
