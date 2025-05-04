require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

console.log('✅ S3 client initialized');

// Use Python script and upload resulting file to S3
app.post('/yt-to-s3', (req, res) => {
  const url = req.body.url;
  if (!url) return res.status(400).json({ error: 'Missing YouTube URL' });

  const videoId = new URL(url).searchParams.get('v');
  const jobName = `${videoId}-${Date.now()}`.replace(/\W+/g, '_');

  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  const py = spawn('python3', ['transcribe.py', videoId], { cwd: __dirname });

  let finalFile = '';

  py.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    const mp3Line = lines.find(line => line.endsWith('.mp3'));
    if (mp3Line) finalFile = mp3Line;
  });

  py.stderr.on('data', (data) => {
    console.error('❌ Python stderr:', data.toString());
  });

  py.on('close', async (code) => {
    if (code !== 0 || !finalFile.endsWith('.mp3')) {
      return res.status(500).json({ error: 'Python script failed or returned no file' });
    }

    try {
      const s3Key = `youtube-audio/${Date.now()}-${path.basename(finalFile)}`;
      const stream = fs.createReadStream(path.resolve(__dirname, finalFile));

      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: stream,
        ContentType: 'audio/mpeg',
      }));

      fs.unlinkSync(path.resolve(__dirname, finalFile));

      const s3Url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      console.log(`✅ Uploaded to: ${s3Url}`);
      res.json({ 
        message: '✅ Uploaded to S3', 
        url: s3Url, 
        key: s3Key, 
        video_id: videoId,
        job_name: jobName 
        
      });
      
    } catch (err) {
      console.error('❌ S3 Upload Failed:', err);
      return res.status(500).json({ error: 'S3 upload failed' });
    }
  });
});

const AWS = require('aws-sdk');
const axios = require('axios');

// Set up Transcribe client
const transcribe = new AWS.TranscribeService({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_TRANSCRIBE_KEY,
  secretAccessKey: process.env.AWS_TRANSCRIBE_SECRET
});


const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get('/get-transcription/:jobName', async (req, res) => {
  const { jobName } = req.params;

  if (!jobName) {
    return res.status(400).json({ error: 'Missing transcription job name' });
  }

  try {
    let job;
    let attempts = 0;
    const maxAttempts = 1000;
    const delayMs = 5000;

    // Poll until complete
    while (attempts < maxAttempts) {
      const data = await transcribe.getTranscriptionJob({ TranscriptionJobName: jobName }).promise();
      job = data.TranscriptionJob;

      if (job.TranscriptionJobStatus === 'COMPLETED' || job.TranscriptionJobStatus === 'FAILED') break;

      console.log(`⏳ Waiting... attempt ${attempts + 1}`);
      attempts++;
      await wait(delayMs);
    }

    if (job.TranscriptionJobStatus !== 'COMPLETED') {
      return res.status(202).json({ status: job.TranscriptionJobStatus });
    }

    const transcriptUri = job.Transcript.TranscriptFileUri;
    const response = await axios.get(transcriptUri);
    const transcriptText = response.data.results.transcripts.map(t => t.transcript).join('\n');

    const videoId = job.TranscriptionJobName.split('_')[0];
    const s3Key = `youtube-audio/${job.TranscriptionJobName}.mp3`;
    const s3Url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    const postResponse = await axios.post(`http://localhost:${PORT}/update-transcription`, {
      video_id: videoId,
      audio_url: s3Url,
      transcript: transcriptText,
      uri: transcriptUri,
      job_name: job.TranscriptionJobName
    });

    console.log('✅ Transcription sent to Supabase:', postResponse.data);
    res.json({
      jobName,
      uri: transcriptUri,
      transcript: transcriptText,
      posted: true,
      supabaseResponse: postResponse.data
    });

  } catch (err) {
    console.error('❌ Transcription fetch/post error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch or post transcription', details: err });
  }
});


// update supabase 
const supabase = require('./supabaseClient');
app.post('/update-transcription', async (req, res) => {
  const { video_id, audio_url, transcript, uri, job_name } = req.body;

  if (!video_id || !audio_url || !transcript || !uri || !job_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // ⬇️ 1. UPSERT into transcriptions table
    const { data: upsertData, error: upsertError } = await supabase
      .from('transcriptions')
      .upsert({
        video_id,
        audio_url,
        transcript,
        uri,
        job_name,
        status: 'processed',
        created_at: new Date().toISOString()
      }, {
        onConflict: ['video_id']
      });

    if (upsertError) {
      console.error('❌ Supabase upsert failed:', upsertError);
      return res.status(500).json({ error: 'Supabase insert failed', details: upsertError });
    }

    console.log('✅ Transcription saved for video:', video_id);

    // ⬇️ 2. UPDATE youtube_video table status
    const { error: updateError } = await supabase
      .from('youtube_video')
      .update({ status: 'processed' })
      .eq('video_id', video_id);

    if (updateError) {
      console.error('❌ Supabase youtube_video update failed:', updateError);
      return res.status(500).json({ error: 'Failed to update youtube_video status', details: updateError });
    }

    console.log('✅ youtube_video status updated to "processed" for video:', video_id);

    res.json({ message: '✅ Transcription + video status saved', data: upsertData });
  } catch (err) {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// trigger
const LOG_FILE = 'yt-trigger.log';
const WEBHOOK_URL = 'https://n8n.codestream.ca/webhook/yt-run';
const LOOP_DELAY_MS = 90_000; // 90 seconds between runs

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG_FILE, line + '\n');
  console.log(line);
}

// trigger loop

app.get('/trigger-loop', async (req, res) => {
  log('🔥 Loop started via /trigger-loop');
  res.json({ message: 'Loop started. Check logs for progress.' });

  while (true) {
    try {
      // Fetch next pending video
      const { data, error } = await supabase
        .from('youtube_video')
        .select('*')
        .eq('status', 'pending')
        .limit(1);

      if (error) {
        log(`❌ Supabase fetch error: ${error.message}`);
        break;
      }

      if (!data || data.length === 0) {
        log('✅ No more pending videos. Exiting loop.');
        break;
      }

      const video = data[0];
      log(`▶️ Triggering video: ${video.video_id}`);

      try {
        const response = await axios.post(
          WEBHOOK_URL,
          { url: video.video_url },
          { timeout: 600_000 } // 10 minutes
        );

        if (response.status === 200) {
          log(`✅ Webhook triggered successfully for video: ${video.video_id}`);
        } else {
          log(`❌ Webhook failed with status ${response.status} for video: ${video.video_id}`);
        }
      } catch (err) {
        log(`❌ Loop error for video_id=${video.video_id}: ${err.message}`);
        await supabase
          .from('youtube_video')
          .update({ status: 'failed' })
          .eq('video_id', video.video_id);
        await new Promise(r => setTimeout(r, 5000));
        continue; // continue to next video
      }

      await new Promise(r => setTimeout(r, LOOP_DELAY_MS)); // Wait before next run

    } catch (err) {
      log(`❌ Fatal loop error: ${err.message}`);
      break;
    }
  }

  log('🛑 Loop finished.');
});



app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
