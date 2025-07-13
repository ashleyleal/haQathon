  'use client';

import React, { useRef, useEffect, useState } from 'react';

const Home: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGood, setIsGood] = useState<boolean | null>(null);

  // Load beep sound
  const beepRef = useRef<HTMLAudioElement | null>(null);

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
            if (result.good === false && beepRef.current) {
              beepRef.current.play().catch((err) => console.error('Beep error:', err));
            }
          } else {
            setIsGood(false);
          }
        } catch (error) {
          console.error('Error sending image to backend:', error);
          setIsGood(false);
        }
      }
    }
  };

  const backgroundColor = isGood === null
    ? '#f9f9f9'
    : isGood
    ? '#d1f5d3'
    : '#f8d7da';

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
      }}
    >
     
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
      <audio ref={beepRef} src="https://www.soundjay.com/buttons/sounds/beep-07.mp3" preload="auto" />
    </div>
  );
};

export default Home;