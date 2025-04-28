window.addEventListener('DOMContentLoaded', () => {
  let mediaRecorder;
  let audioChunks = [];
  let recordedAudioBlob;

  const startButton       = document.getElementById('startRecord');
  const stopButton        = document.getElementById('stopRecord');
  const uploadButton      = document.getElementById('uploadButton');
  const audioUpload       = document.getElementById('audioUpload');
  const status            = document.getElementById('status');
  const error             = document.getElementById('error');
  const transcriptArea    = document.getElementById('transcript');
  const summaryArea       = document.getElementById('summary');
  const audioPlayer       = document.getElementById('audioPlayer');
  const summaryLength     = document.getElementById('summaryLength');
  const regenerateButton  = document.getElementById('regenerateSummary');
  const spinner           = status.querySelector('.spinner');

  // Initially disable regenerate until we have a transcript
  regenerateButton.disabled = true;

  // Trigger file input via button
  uploadButton.addEventListener('click', () => audioUpload.click());

  // Set up microphone recording
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

      mediaRecorder.onstop = async () => {
        statusUpdate('Processing audio...', true);
        const blob = new Blob(audioChunks, { type: recordedAudioBlob?.type || 'audio/webm' });
        audioChunks = [];
        recordedAudioBlob = blob;
        setupAudio(blob);
        await transcribeAudio(blob);
      };

      startButton.onclick = () => {
        mediaRecorder.start();
        toggleButtons(true);
        statusUpdate('Recording...', true);
      };
      stopButton.onclick = () => {
        mediaRecorder.stop();
        toggleButtons(false);
        statusUpdate('Stopped recording.', false);
      };
    })
    .catch(err => showError('Error accessing microphone: ' + err.message));

  // Handle file upload
  audioUpload.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    recordedAudioBlob = file;
    statusUpdate('File selected. Processing...', true);
    setupAudio(file);
    await transcribeAudio(file);
  };

  function setupAudio(blob) {
    try {
      if (!blob || blob.size === 0) {
        throw new Error('Invalid or empty audio blob');
      }
      const url = URL.createObjectURL(blob);
      audioPlayer.src = url;
      audioPlayer.classList.remove('hidden');
      audioPlayer.classList.add('fade-in');

      audioPlayer.onloadedmetadata = () => {
        console.log('Audio metadata loaded:', {
          duration: audioPlayer.duration,
          readyState: audioPlayer.readyState,
          paused: audioPlayer.paused
        });
      };
      audioPlayer.onended = () => {
        URL.revokeObjectURL(url);
        console.log('Audio playback ended, cleaned up');
      };
    } catch (e) {
      showError('Error setting up audio playback: ' + e.message);
      console.error('Audio setup error:', e);
    }
  }

  async function transcribeAudio(blob) {
    try {
      statusUpdate('Uploading audio...', true);
      const upRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob
      });
      const upData = await upRes.json();
      if (upData.error) throw new Error(upData.error);

      statusUpdate('Requesting transcription...', true);
      const txRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: upData.upload_url })
      });
      const txData = await txRes.json();
      if (txData.error) throw new Error(txData.error);

      let result;
      while (true) {
        statusUpdate('Polling transcription status...', true);
        const stRes = await fetch(`/api/transcript/${txData.id}`);
        result = await stRes.json();
        if (result.error) throw new Error(result.error);
        if (result.status === 'completed') break;
        if (result.status === 'error') throw new Error('Transcription failed: ' + result.error);
        await new Promise(r => setTimeout(r, 1000));
      }

      transcriptArea.value = result.text;
      // Enable regenerate once we have text
      regenerateButton.disabled = false;

      summaryArea.value = '';
      statusUpdate('Transcription complete. Generating summary...', true);
      await summarizeText(result.text);
    } catch (e) {
      showError(e.message);
    }
  }

  async function summarizeText(text) {
    try {
      const selectedLength = summaryLength.value || 'medium';
      statusUpdate('Generating summary...', true);
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, summary_length: selectedLength })
      });
      const js = await res.json();
      if (js.error) throw new Error(js.error);
      summaryArea.value = js.summary.trim();
      statusUpdate(`Summary complete (${js.selected_length}).`, false);
    } catch (e) {
      showError('Error summarizing: ' + e.message);
    }
  }

  // Re-summarize when the dropdown changes
  summaryLength.addEventListener('change', () => {
    if (transcriptArea.value.trim()) {
      summarizeText(transcriptArea.value);
    }
  });

  // Or when user clicks “Regenerate Summary”
  regenerateButton.addEventListener('click', () => {
    if (transcriptArea.value.trim()) {
      summarizeText(transcriptArea.value);
    } else {
      showError('No transcript to summarize!');
    }
  });

  function toggleButtons(recording) {
    startButton.disabled = recording;
    stopButton.disabled  = !recording;
  }

  function statusUpdate(msg, showSpinner = true) {
    status.querySelector('span').textContent = msg;
    status.classList.remove('hidden');
    status.classList.add('fade-in');
    error.classList.add('hidden');
    spinner.classList.toggle('hidden', !showSpinner);
    console.log('Status update:', msg);
  }

  function showError(msg) {
    error.querySelector('span').textContent = msg;
    error.classList.remove('hidden');
    error.classList.add('fade-in');
    status.classList.add('hidden');
    spinner.classList.add('hidden');
    console.log('Error shown:', msg);
  }

  // Utility
  window.copyText = id => {
    navigator.clipboard.writeText(document.getElementById(id).value)
      .then(() => statusUpdate('Copied!', false))
      .catch(e => showError('Copy failed: ' + e.message));
  };

  window.downloadText = (id, prefix) => {
    const text = document.getElementById(id).value;
    if (!text) return showError('Nothing to download!');
    const format = document.getElementById(`${id}Format`)?.value || 'txt';
    const filename = `${prefix}.${format}`;

    if (format === 'txt') {
      const blob = new Blob([text], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const { jsPDF } = window.jspdf || {};
      const doc = new jsPDF();
      const lines = doc.splitTextToSize(text, 180);
      let y = 10;
      lines.forEach(line => {
        if (y > 280) { // Page height limit
          doc.addPage();
          y = 10;
        }
        doc.text(line, 10, y);
        y += 10;
      });
      doc.save(filename);
    } else if (format === 'doc') {
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${filename}</title></head><body>${text.replace(/\n/g,'<br>')}</body></html>`;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    statusUpdate('Downloaded successfully!', false);
  };

  window.downloadRecording = () => {
    if (!recordedAudioBlob) return showError('No recording available!');
    const url = URL.createObjectURL(recordedAudioBlob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = recordedAudioBlob.name || 'recording.webm';
    a.click();
    URL.revokeObjectURL(url);
    statusUpdate('Recording downloaded!', false);
  };
});