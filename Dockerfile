FROM node:18

# Install required system packages
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3.11-venv ffmpeg curl

# Install yt-dlp CLI manually (not via pip)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Create and activate a virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python packages inside venv
RUN pip install --upgrade pip && pip install whisper yt_dlp openai

# Set working directory
WORKDIR /app

# Copy app code
COPY . .

# Install Node.js dependencies
RUN npm install

# Expose port
EXPOSE 3002

# Start the Node.js app
CMD ["node", "app.js"]
