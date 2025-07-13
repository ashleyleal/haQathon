'use client';

import React, { useRef, useEffect, useState } from 'react';

const Home: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGood, setIsGood] = useState<boolean | null>(null);
  const [keypoints, setKeypoints] = useState<Array<[number, number]>>([]);
  
  // Bad posture tracking
  const [badPostureStartTime, setBadPostureStartTime] = useState<number | null>(null);
  const [badPostureDuration, setBadPostureDuration] = useState<number>(0);
  const [isInBadPosture, setIsInBadPosture] = useState<boolean>(false);

  // Load beep sound
  const beepRef = useRef<HTMLAudioElement | null>(null);

  // Create beep sound
  const playBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing beep:', error);
    }
  };

  useEffect(() => {
    const getVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    };

    getVideo();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      takeSnapshot();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const takeSnapshot = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        const width = 256;
        const height = 192;
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');

        try {
          const response = await fetch('http://127.0.0.1:8000/predict/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image_base64: dataUrl }),
          });

          const result = await response.json();
          if (response.ok) {
            setIsGood(result.good);
            // exclude wrist, ankle and knee
            setKeypoints(result.keypoints.slice(0, 9).concat(result.keypoints.slice(11, 13)) || []);
          } else {
            setIsGood(null);
            setKeypoints([]);
          }
        } catch (error) {
          console.error('Error sending image to backend:', error);
          setIsGood(null);
        }
      }
    }
  };

  // Draw keypoints on overlay canvas
  const drawKeypoints = () => {
    const overlayCanvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlayCanvas || !video || keypoints.length === 0) return;

    const context = overlayCanvas.getContext('2d');
    if (!context) return;

    // Clear canvas
    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    const scaleX = 640 / 256;
    const scaleY = 480 / 192;

    const keypointNames = [
      "nose", "left_eye", "right_eye", "left_ear", "right_ear",
      "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
      "left_wrist", "right_wrist", "left_hip", "right_hip"
    ];

    const connections = [[1, 2], [3, 4], [5, 6], [7, 8], [11, 12]];

    // Draw connection lines
    context.strokeStyle = isGood ? '#28a745' : '#dc3545';
    context.lineWidth = 2;
    connections.forEach(([startIdx, endIdx]) => {
      if (startIdx < keypoints.length && endIdx < keypoints.length) {
        const [y1, x1] = keypoints[startIdx];
        const [y2, x2] = keypoints[endIdx];
        
        context.beginPath();
        context.moveTo(x1 * scaleX, y1 * scaleY);
        context.lineTo(x2 * scaleX, y2 * scaleY);
        context.stroke();
      }
    });

    keypoints.forEach(([y, x], index) => {
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;

      // Draw circle
      context.beginPath();
      context.arc(scaledX, scaledY, 4, 0, 2 * Math.PI);
      context.fillStyle = isGood ? '#28a745' : '#dc3545';
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1;
      context.stroke();

      // labels
      context.fillStyle = '#ffffff';
      context.font = '10px Arial';
      context.fillText(keypointNames[index] || index.toString(), scaledX + 6, scaledY - 6);
    
    });
  };

  // Update overlay when keypoints change
  useEffect(() => {
    drawKeypoints();
  }, [keypoints, isGood]);

  // Update bad posture duration
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isInBadPosture) {
      timer = setInterval(() => {
        setBadPostureDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setBadPostureDuration(0);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isInBadPosture]);

  useEffect(() => {
    if (isGood === false) {
      if (!isInBadPosture) {
        // Start tracking bad posture
        setIsInBadPosture(true);
        setBadPostureStartTime(Date.now());
      }
      if (badPostureDuration == 5) {
        playBeep();
      } else if (badPostureDuration > 60 && badPostureDuration < 63){ // play for 3 seconds
        playBeep();
      } else if (badPostureDuration >= 120) { // play forever
        playBeep();
      }
    } else {
      // Reset bad posture tracking when posture is good
      setIsInBadPosture(false);
      setBadPostureStartTime(null);
      setBadPostureDuration(0);
    }
  }, [isGood, badPostureDuration, isInBadPosture]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const backgroundColor = isGood === null
    ? '#f9f9f9'
    : isGood
    ? '#d1f5d3'
    : badPostureDuration >= 120 // 2 minutes - Critical level
    ? '#721c24' // Very dark red
    : badPostureDuration >= 60  // 1 minute - Warning level
    ? '#dc3545' // Dark red
    : '#f8d7da'; // Light red - Initial bad posture

  const headerText = isGood === null
    ? 'Analyzing posture...'
    : isGood
    ? '✅ Good posture detected'
    : '⚠️ Bad posture detected';

  return (
    <div
      style={{
        backgroundColor,
        color: '#333',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Segoe UI, sans-serif',
        transition: 'background-color 0.3s ease',
        padding: '2rem',
        position: 'relative',
      }}
    >
      {/* Stopwatch for bad posture duration - positioned on the right */}
      {isInBadPosture && (
        <div
          style={{
            position: 'fixed',
            top: '2rem',
            right: '2rem',
            padding: '1rem 2rem',
            borderRadius: '12px',
            backgroundColor: '#fff3cd',
            border: '2px solid #ffeaa7',
            color: '#856404',
            fontSize: '1.4rem',
            fontWeight: 'bold',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '200px',
          }}
        >
          ⏱️ Bad posture for:<br />
          <span style={{ fontSize: '1.6rem', color: '#d63384' }}>
            {formatDuration(badPostureDuration)}
          </span>
        </div>
      )}
     
      <h1
        style={{
          marginBottom: '1.5rem',
          fontSize: '1.5rem',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          backgroundColor:
            isGood === null
              ? '#ffffff'
              : isGood
              ? '#f0fff4' // very light green
              : '#fff5f5', // very light red
          color: '#222',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e0e0e0',
          transition: 'background-color 0.3s ease',
        }}
      >
        {headerText}
      </h1>

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          width={640}
          height={480}
          style={{
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            marginBottom: '1rem',
          }}
        />
        <canvas
          ref={overlayCanvasRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            borderRadius: '8px',
            pointerEvents: 'none',
            border: '2px solid white',
            boxSizing: 'border-box',
          }}
        />
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default Home;