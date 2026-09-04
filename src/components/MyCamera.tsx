'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Download, Square, Play, Upload } from 'lucide-react';

type RecordingStatus = 'idle' | 'recording' | 'stopping' | 'completed';

interface RecordedVideo {
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
}

const MyCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [recordedVideos, setRecordedVideos] = useState<RecordedVideo[]>([]);
  const [timer, setTimer] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const MAX_RECORDING_TIME = 40 * 60 * 1000; // 40 minutes in milliseconds

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setError('Camera access denied or unavailable');
      setCameraActive(false);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setError('Camera not initialized');
      return;
    }

    chunksRef.current = [];
    startTimeRef.current = Date.now();
    setTimer(0);
    setRecordingDuration(0);

    const mimeType = 'video/webm';
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType,
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const duration = recordingDuration;

      setRecordedVideos((prev) => [
        ...prev,
        {
          blob,
          url,
          duration,
          timestamp: new Date(),
        },
      ]);

      setStatus('completed');
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setStatus('recording');
  }, [recordingDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      setStatus('stopping');
      mediaRecorderRef.current.stop();
    }
  }, [status]);

  // Timer effect for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'recording') {
      interval = setInterval(() => {
        setTimer((prev) => {
          const newTime = prev + 1;
          setRecordingDuration(newTime);
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Auto-stop after 40 minutes
  useEffect(() => {
    if (recordingDuration >= 40 * 60) {
      stopRecording();
    }
  }, [recordingDuration, stopRecording]);

  // Download video
  const downloadVideo = (video: RecordedVideo, index: number) => {
    const url = video.url;
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${video.timestamp.toISOString().split('T')[0]}_${index + 1}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">MyCamera - Video Recording Studio</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Video Preview */}
      <div className="mb-6 relative bg-black rounded-lg overflow-hidden shadow-lg">
        <video
          ref={videoRef}
          autoPlay
          muted
          className="w-full h-auto aspect-video object-cover"
        />
        {status === 'recording' && (
          <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Recording - {formatTime(timer)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {!cameraActive && (
          <button
            onClick={initializeCamera}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <Play size={18} />
            Start Camera
          </button>
        )}

        {cameraActive && status === 'idle' && (
          <button
            onClick={startRecording}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <Square size={18} />
            Start Recording
          </button>
        )}

        {status === 'recording' && (
          <button
            onClick={stopRecording}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <Square size={18} />
            Stop Recording
          </button>
        )}

        {/* Timer info */}
        {status === 'recording' && (
          <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg font-semibold">
            Max time: {formatTime(MAX_RECORDING_TIME / 1000)} | Recording: {formatTime(timer)}
          </div>
        )}
      </div>

      {/* Recorded Videos List */}
      {recordedVideos.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Recorded Videos ({recordedVideos.length})</h3>
          <div className="space-y-3">
            {recordedVideos.map((video, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-700 dark:text-gray-200">
                    Recording {index + 1}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {video.timestamp.toLocaleString()} • {formatTime(video.duration)}
                  </p>
                </div>
                <button
                  onClick={() => downloadVideo(video, index)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 ml-4 font-semibold"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <strong>Note:</strong> Recordings are saved to your local computer. You can record up to 40 minutes continuously. All videos are stored locally in your browser.
        </p>
      </div>
    </div>
  );
};

export default MyCamera;
