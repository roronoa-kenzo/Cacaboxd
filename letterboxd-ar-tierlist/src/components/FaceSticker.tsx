import React, { useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { loadFaceModels } from '../utils/loadModels';

type FaceStickerProps = {
  stickerUrl: string;
};

export default function FaceSticker({ stickerUrl }: FaceStickerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function startVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    }

    async function runFaceDetection() {
      await loadFaceModels();

      if (!videoRef.current) return;

      videoRef.current.addEventListener('play', () => {
        const canvas = faceapi.createCanvasFromMedia(videoRef.current!);
        canvasRef.current?.parentNode?.insertBefore(canvas, canvasRef.current);

        const displaySize = {
          width: videoRef.current!.videoWidth,
          height: videoRef.current!.videoHeight,
        };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
          const detections = await faceapi.detectAllFaces(
            videoRef.current!,
            new faceapi.TinyFaceDetectorOptions()
          );
          const resizedDetections = faceapi.resizeResults(detections, displaySize);

          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          resizedDetections.forEach(detection => {
            const box = detection.box;
            const img = new Image();
            img.src = stickerUrl;

            img.onload = () => {
              ctx?.drawImage(
                img,
                box.x - box.width * 0.25,
                box.y - box.height * 0.6,
                box.width * 1.5,
                box.height * 1.5
              );
            };
          });
        }, 100);
      });
    }

    startVideo();
    runFaceDetection();
  }, [stickerUrl]);

  return (
    <div style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        width="720"
        height="560"
        style={{ position: 'relative', zIndex: 1 }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
      />
    </div>
  );
}
