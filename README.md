# Scholarly Snap Assistant

## Overview
**Scholarly Snap Assistant** is a web application that captures audio from lectures or meetings, transcribes it using [AssemblyAI](https://www.assemblyai.com/), and generates summaries using [OpenAI](https://openai.com/). It offers an intuitive interface for recording or uploading audio, viewing transcripts, generating summaries of varying lengths, and downloading outputs in multiple formats (TXT, PDF, DOC). The backend securely handles API keys to prevent client-side exposure.

### Features
- **Audio Recording**: Record audio directly in the browser using the MediaRecorder API.
- **Audio Upload**: Upload audio files for transcription.
- **Transcription**: Convert audio to text using AssemblyAI’s transcription service.
- **Summarization**: Generate summaries (short: 1-2 sentences, medium: 2-3 sentences, detailed: 3-5 sentences) using OpenAI’s GPT-3.5-turbo model.
- **Playback and Download**: Play recorded audio and download recordings, transcripts, or summaries as `.webm`, `.txt`, `.pdf`, or `.doc` files.
- **Secure API Handling**: API keys are managed server-side via environment variables.
- **Responsive UI**: Built with Tailwind CSS for a modern, mobile-friendly experience.

## Technologies
- **Frontend**: HTML, Tailwind CSS, custom CSS, JavaScript, jsPDF (for PDF export)
- **Backend**: Node.js, Express
- **Dependencies**: `cors`, `dotenv`, `express`, `fluent-ffmpeg`, `node-fetch`
- **External Tools**: FFmpeg (for audio conversion)
- **APIs**:
  - AssemblyAI (transcription)
  - OpenAI (summarization)
- **Styling**: Tailwind CSS, custom CSS for animations and gradients

## Prerequisites
- **Node.js**: Version 20.12.1 or higher
- **npm**: Version 6 or higher
- **FFmpeg**: Required for audio conversion (install via `brew install ffmpeg` on macOS or equivalent for your OS)
- **API Keys**:
  - AssemblyAI API key (sign up at [assemblyai.com](https://www.assemblyai.com/))
  - OpenAI API key (sign up at [openai.com](https://openai.com/))

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/samaneh-shn/scholarly-snap-assistant.git
cd scholarly-snap-assistant
```

### 2. Install FFmpeg
FFmpeg is required for audio conversion. On macOS:
```bash
brew install ffmpeg
```
On Ubuntu:
```bash
sudo apt update
sudo apt install ffmpeg
```
Verify installation:
```bash
ffmpeg -version
```

### 3. Install Dependencies
Install Node.js packages:
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the project root and add your API keys:
```
ASSEMBLYAI_API_KEY=your_assemblyai_key
OPENAI_API_KEY=your_openai_key
```

**Note**: Do not commit `.env` to version control. The `.gitignore` already excludes:
```
.env
node_modules/
```

### 5. Start the Server
Run the application:
```bash
npm start
```
The server will start at `http://localhost:8000`. Open this URL in a web browser.

## Usage
1. **Access the Application**:
   - Navigate to `http://localhost:8000` in a modern browser (Chrome, Firefox, or Edge recommended).
2. **Record or Upload Audio**:
   - Click **Start Recording** to capture audio, then **Stop Recording** to end.
   - Alternatively, click **Upload Audio** to select an audio file (e.g., `.mp3`, `.wav`).
3. **View Results**:
   - Play the audio in the **Recording Playback** section.
   - View the transcribed text in the **Transcript** textarea.
   - Read the generated summary in the **Summary** textarea (select length: short, medium, or detailed).
4. **Export Data**:
   - Download transcripts or summaries as `.txt`, `.pdf`, or `.doc` files.
   - Download recordings as `.webm` files.
   - Use the **Regenerate Summary** button to create a new summary with a different length.

## Security
The application is designed with security in mind:
- **Server-Side API Handling**: API calls to AssemblyAI and OpenAI are proxied through the backend (`/api/upload`, `/api/transcribe`, `/api/summarize`), keeping API keys server-side.
- **Environment Variables**: API keys are stored in `.env`, excluded from version control.
- **CORS**: Enabled via the `cors` package, allowing requests from `http://localhost:8000`. For production, restrict origins in `server.js`:
  ```javascript
  app.use(cors({ origin: 'https://your-deployed-url.com' }));
  ```

### Security Recommendations
- **Revoke Exposed Keys**: If API keys were previously exposed, revoke them in the AssemblyAI and OpenAI dashboards and generate new ones.
- **Restrict API Keys**:
  - AssemblyAI: Limit keys to specific IP addresses or domains.
  - OpenAI: Set usage limits and monitor for unusual activity.
- **HTTPS**: Use HTTPS in production, as `navigator.mediaDevices.getUserMedia` requires a secure context.

## Project Structure
```
scholarly-snap-assistant/
├── .env              # Environment variables (API keys)
├── .gitignore        # Git ignore file
├── index.html        # Main HTML file
├── package.json      # Node.js dependencies and scripts
├── script.js         # Frontend JavaScript logic
├── server.js         # Backend server (Express)
├── styles.css        # Custom CSS for styling
├── favicon.ico       # Favicon 
├── logo.png          # Logo 
```

## Troubleshooting
- **Server Fails to Start**:
  - Ensure all dependencies are installed (`npm install`).
  - Verify FFmpeg is installed (`ffmpeg -version`).
  - Check `.env` for valid API keys.
  - Confirm `server.js` uses `require('express')` and `require('cors')`.
- **Transcription/Summarization Fails**:
  - Check server logs (`npm start`) and browser DevTools Console (F12) for errors.
  - Verify API keys in `.env` are correct and active.
  - Ensure audio files are supported (e.g., `.wav`, `.mp3`) and under 50MB.
- **CORS Errors**:
  - Ensure `cors` is installed (`npm list cors`) and enabled in `server.js`.
  - For production, update the CORS origin to match your frontend URL.
- **Missing Assets**:
  - If `favicon.ico` or `logo.png` are missing, add them to the project root or update `index.html` to remove references.

## Deployment
To deploy the application (e.g., to Heroku, Render, or Netlify):
1. **Commit Changes**:
   ```bash
   git add .
   git commit -m "Deploy Scholarly Snap Assistant"
   ```
2. **Deploy to Render** (example):
   - Create a new Web Service on [Render](https://render.com/).
   - Set the build command: `npm install`.
   - Set the start command: `npm start`.
   - Add environment variables (`ASSEMBLYAI_API_KEY`, `OPENAI_API_KEY`) in the Render dashboard.
3. **Update CORS**:
   - In `server.js`, set the CORS origin to your deployed URL:
     ```javascript
     app.use(cors({ origin: 'https://your-app.onrender.com' }));
     ```
4. **Ensure HTTPS**:
   - Render and similar platforms provide free SSL. Verify the app uses `https://`.
5. **Install FFmpeg**:
   - For platforms like Render, add FFmpeg as a build dependency or use a Docker container with FFmpeg pre-installed.

## Contributing
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -m "Add your feature"`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a pull request.

Please include tests for new features and follow the existing code style.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or collaboration, feel free to reach out:

GitHub: [samaneh-shn](https://github.com/samaneh-shn)

Email: shirinnezhad.samaneh@gmail.com
