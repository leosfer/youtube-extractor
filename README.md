# YT Data Harvester

A desktop application built with Electron to extract video metadata (titles, view counts, upload dates) and transcriptions from any YouTube channel. The extracted data can be easily exported to both XLSX (Excel) and JSON formats for analysis.

## ✨ Features

-   **Channel Video Fetching**: Input any YouTube channel URL to get a complete list of all its videos.
-   **Selective Extraction**: Choose specific videos from the list for data extraction.
-   **Rich Data Export**: Extracts video title, view count, upload date, and the full auto-generated transcription.
-   **Multiple Formats**: Download the collected data as a `.xlsx` (Excel) or `.json` file.
-   **Efficient Processing**: Utilizes concurrent processing to speed up the data extraction for multiple videos.
-   **Real-time Feedback**: A detailed status log and progress bar keep you informed throughout the process.
-   **Self-Contained**: Automatically downloads and manages the `yt-dlp` executable, the core engine for data fetching.

## 🚀 How to Use (For Users)

1.  Go to the **Releases** page of this repository and download the latest installer for your operating system.
2.  Run the installer and launch the **YT Data Harvester** application.
3.  **Paste the URL** of the YouTube channel you want to analyze into the input field.
4.  Click the **"Buscar Vídeos"** (Fetch Videos) button. The application will list all videos from that channel.
5.  **Select the videos** you are interested in. You can use the "Select All" checkbox or the "Quick Select" buttons (Top 50, Top 100, etc.). The list can be sorted by title or view count.
6.  Click the **"Extrair Dados"** (Extract Data) button to begin the process.
7.  Once the extraction is complete, click **"Download .XLSX"** or **"Download .JSON"** to save the data to your computer.

## 🛠️ Development Setup

To run this project locally for development purposes, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/yt-data-harvester.git
    cd yt-data-harvester
    ```

2.  **Install dependencies:**
    Node.js is required.
    ```bash
    npm install
    ```

3.  **Run the application:**
    ```bash
    npm start
    ```
    This will start the Electron application in development mode.

## 📦 Building the Application

To package the application into a distributable installer, run the build script:

```bash
npm run build
```

The build process, managed by `electron-builder`, will create an installer in the `dist` directory.

## ⚙️ How It Works

This application is built on the **Electron** framework, allowing it to run as a cross-platform desktop app using web technologies (HTML, CSS, JavaScript).

-   **Main Process (`main.js`)**: The Node.js backend that has access to the operating system. It's responsible for creating the application window and handling all heavy-lifting tasks, such as spawning a `yt-dlp` child process to fetch data from YouTube.
-   **Renderer Process (`renderer.js`)**: The front-end of the application, which runs in the browser window. It handles user interface logic and communicates with the Main process via IPC (Inter-Process Communication) to request data or trigger actions.
-   **`yt-dlp`**: A powerful command-line tool that is the core engine for downloading all video metadata and transcriptions from YouTube. The app ensures `yt-dlp` is available and up-to-date.

## 📄 License

This project is licensed under the ISC License. See the `package.json` file for more details.
