const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3002;

app.use(express.json());

// Serve static files (like .mp3/.wav output)
app.use('/files', express.static(__dirname));

app.post('/transcribe', (req, res) => {
  const url = req.body.url;
  if (!url) return res.status(400).send({ error: 'Missing YouTube URL' });

  const videoId = new URL(url).searchParams.get('v');
  if (!videoId) return res.status(400).send({ error: 'Invalid YouTube URL' });

  const child = spawn('python3', ['transcribe.py', videoId], {
    cwd: __dirname,
  });

  let lastLine = '';
  child.stdout.on('data', (data) => {
    lastLine = data.toString().trim().split('\n').pop();
  });

  child.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  child.on('close', (code) => {
    if (code !== 0 || !lastLine) {
      return res.status(500).send({ error: 'Transcription failed' });
    }

    const fileName = path.basename(lastLine);
    const publicUrl = `https://youtube-audio-3jgp.onrender.com/files/${fileName}`; // Replace with your Render domain

    res.send({
      message: '✅ Audio downloaded and compressed.',
      file: fileName,
      url: publicUrl,
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
