'use client';

import React, { useRef, useEffect, useState } from 'react';

const Home: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGood, setIsGood] = useState<boolean | null>(null);
  const [keypoints, setKeypoints] = useState<[number, number][] | null>(null);
  
  // Bad posture tracking
  const [badPostureDuration, setBadPostureDuration] = useState<number>(0);
  const [isInBadPosture, setIsInBadPosture] = useState<boolean>(false);

  // Good posture tracking
  const [goodPostureDuration, setGoodPostureDuration] = useState<number>(0);
  const [isInGoodPosture, setIsInGoodPosture] = useState<boolean>(false);

  // Load beep sound
  const beepRef = useRef<HTMLAudioElement | null>(null);

  // Keypoint names and connections for pose visualization
  const keypointNames = [
    'nose', 'left eye', 'right eye', 'left ear', 'right ear',
    'left shoulder', 'right shoulder', 'left elbow', 'right elbow',
    'left wrist', 'right wrist', 'left hip', 'right hip',
    'left knee', 'right knee', 'left ankle', 'right ankle'
  ];

  // Define skeleton connections 
  const connections = [
    // Face
    [0, 1], [0, 2], [1, 3], [2, 4],
    // Arms
    [5, 6], [5, 7], [6, 8], [7, 9], [8, 10],
    // Torso
    [5, 11], [6, 12], [11, 12]
  ];

  // const connections = [[1, 2], [3, 4], [5, 6], [7, 8], [11, 12]];

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
            setKeypoints(result.keypoints.slice(0, 13) || []);
          } else {
            setIsGood(null);
            setKeypoints([]);
          }
        } catch (error) {
          console.error('Error sending image to backend:', error);
          setIsGood(null);
          setKeypoints([]);
        }
      }
    }
  };

  // Draw keypoints and skeleton on video
  const drawKeypoints = () => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (video && overlayCanvas && keypoints) {
      const context = overlayCanvas.getContext('2d');
      if (context) {
        // Set canvas size to match video display size
        const videoRect = video.getBoundingClientRect();
        overlayCanvas.width = video.videoWidth || 640;
        overlayCanvas.height = video.videoHeight || 480;
        overlayCanvas.style.width = `${videoRect.width}px`;
        overlayCanvas.style.height = `${videoRect.height}px`;
        overlayCanvas.style.position = 'absolute';
        overlayCanvas.style.top = '0';
        overlayCanvas.style.left = '0';
        overlayCanvas.style.pointerEvents = 'none';
        
        context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // Calculate scaling factors from model input (256x192) to video display
        const scaleX = overlayCanvas.width / 256 * 1.1;
        const scaleY = overlayCanvas.height / 192;

        // offsets i found through trial and error
        const offsetX = video.videoWidth * 0.1;
        const offsetY = video.videoHeight * 0.125;
        
        // Draw connection lines
        context.strokeStyle = isGood ? '#28a745' : '#dc3545';
        context.lineWidth = 2;
        connections.forEach(([startIdx, endIdx]) => {
          if (startIdx < keypoints.length && endIdx < keypoints.length) {
            const [y1, x1] = keypoints[startIdx];
            const [y2, x2] = keypoints[endIdx];
            
            context.beginPath();
            context.moveTo(x1 * scaleX + offsetX, y1 * scaleY - offsetY);
            context.lineTo(x2 * scaleX + offsetX, y2 * scaleY - offsetY);
            context.stroke();
          }
        });

        // Draw keypoints
        keypoints.forEach(([y, x], index) => {
          const scaledX = x * scaleX;
          const scaledY = y * scaleY;

          // Draw circle
          context.beginPath();
          context.arc(scaledX + offsetX, scaledY - offsetY, 4, 0, 2 * Math.PI);
          context.fillStyle = isGood ? '#28a745' : '#dc3545';
          context.fill();
          context.strokeStyle = '#ffffff';
          context.lineWidth = 1;
          context.stroke();

          // Labels
          context.fillStyle = '#ffffff';
          context.font = '10px Arial';
          context.fillText(keypointNames[index] || index.toString(), scaledX + 6, scaledY - 6);
        });
      }
    }
  };

  // Draw keypoints when they change
  useEffect(() => {
    if (keypoints) {
      requestAnimationFrame(drawKeypoints);
    } else {
      // Clear the overlay canvas when no keypoints
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        const context = overlayCanvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
      }
    }
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

  // Update good posture duration
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isInGoodPosture) {
      timer = setInterval(() => {
        setGoodPostureDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setGoodPostureDuration(0);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isInGoodPosture]);

  useEffect(() => {
    if (isGood === false) {
      if (!isInBadPosture) {
        // Start tracking bad posture
        setIsInBadPosture(true);
      }
      // Stop tracking good posture
      setIsInGoodPosture(false);
      setGoodPostureDuration(0);
      
      if (badPostureDuration == 5) {
        playBeep();
      } else if (badPostureDuration > 60 && badPostureDuration < 63){ // play for 3 seconds
        playBeep();
      } else if (badPostureDuration >= 120) { // play forever
        playBeep();
      }
    } else if (isGood === true) {
      // Reset bad posture tracking when posture is good
      setIsInBadPosture(false);
      setBadPostureDuration(0);
      
      if (!isInGoodPosture) {
        // Start tracking good posture
        setIsInGoodPosture(true);
      }
    } else {
      // Reset both when posture is unknown
      setIsInBadPosture(false);
      setBadPostureDuration(0);
      setIsInGoodPosture(false);
      setGoodPostureDuration(0);
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
      {/* Stopwatch for bad posture duration */}
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

      {/* Stopwatch for good posture duration */}
      {isInGoodPosture && (
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
          ⏱️ Good posture for:<br />
          <span style={{ fontSize: '1.6rem', color: '#28a745' }}>
            {formatDuration(goodPostureDuration)}
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
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <canvas ref={overlayCanvasRef} style={{ display: keypoints ? 'block' : 'none' }} />
      </div>
    </div>
  );
};

export default Home;