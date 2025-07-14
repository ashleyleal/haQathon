'use client';

import React, { useRef, useEffect, useState } from 'react';

const Home: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGood, setIsGood] = useState<boolean | null>(null);
  
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
          } else {
            setIsGood(null);
          }
        } catch (error) {
          console.error('Error sending image to backend:', error);
          setIsGood(null);
        }
      }
    }
  };

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
    </div>
  );
};

export default Home;