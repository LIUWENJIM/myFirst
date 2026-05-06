import { useRef, useState, useEffect } from 'react';
// @ts-ignore - vad is loaded via script tag
import { Mic, MicOff } from 'lucide-react';

declare global {
  interface Window {
    vad: {
      MicVAD: {
        new: (config: any) => Promise<{
          start: () => Promise<void>;
          pause: () => void;
          destroy: () => void;
        }>;
      };
    };
  }
}

interface AudioRecorderProps {
  isRecording: boolean;
  onRecordingChange: (isRecording: boolean) => void;
  onAudioData: (audioData: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export default function AudioRecorder({
  isRecording,
  onRecordingChange,
  onAudioData,
  onSpeechStart,
  onSpeechEnd,
}: AudioRecorderProps) {
  const [volume, setVolume] = useState(0);
  const mediaRecorderRef = useRef<{ stop: () => void; stream: MediaStream } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<any>(null);

  const float32ToInt16Pcm = (inputData: Float32Array): Int16Array => {
    const pcmData = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcmData;
  };

  const int16ToBase64 = (pcmData: Int16Array): string => {
    const bytes = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      if (!window.vad || !window.vad.MicVAD) {
        throw new Error('VAD library not loaded. Please refresh the page.');
      }

      const vadInstance = await window.vad.MicVAD.new({
        getStream: async () => stream,
        onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
        baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/',
        onSpeechStart: () => {
          onSpeechStart?.();
        },
        onSpeechEnd: () => {
          onSpeechEnd?.();
        },
      });
      vadRef.current = vadInstance;
      await vadInstance.start();

      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      intervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(average);
      }, 100);

      const bufferSize = 4096;
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      const SAMPLES_PER_CHUNK = 16000;
      let pendingPcm = new Int16Array(0);

      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = float32ToInt16Pcm(inputData);

        const combined = new Int16Array(pendingPcm.length + pcmData.length);
        combined.set(pendingPcm, 0);
        combined.set(pcmData, pendingPcm.length);

        let read = 0;
        while (combined.length - read >= SAMPLES_PER_CHUNK) {
          const chunk = combined.subarray(read, read + SAMPLES_PER_CHUNK);
          read += SAMPLES_PER_CHUNK;

          const base64 = int16ToBase64(chunk);
          onAudioData(base64);
        }

        pendingPcm = combined.subarray(read);
      };

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;

      source.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      mediaRecorderRef.current = {
        stop: () => {
          scriptProcessor.disconnect();
          source.disconnect();
          gainNode.disconnect();
          stream.getTracks().forEach(track => track.stop());
        },
        stream: stream
      };

      onRecordingChange(true);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (vadRef.current) {
      vadRef.current.pause();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setVolume(0);
    onRecordingChange(false);
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      {isRecording && (
        <div
          className="absolute rounded-full border pointer-events-none transition-all duration-75"
          style={{
            borderColor: 'rgba(204,120,92,0.5)',
            width: `${100 + (volume / 255) * 100}%`,
            height: `${100 + (volume / 255) * 100}%`,
            opacity: Math.max(0, 1 - (volume / 255) * 1.5),
          }}
        />
      )}

      <button
        onClick={toggleRecording}
        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 text-white"
        style={{
          backgroundColor: isRecording ? 'var(--color-primary)' : 'var(--color-surface-dark)',
        }}
        title={isRecording ? '停止录音' : '开始说话'}
      >
        {isRecording ? (
          <Mic className="w-7 h-7" />
        ) : (
          <MicOff className="w-7 h-7" style={{color: 'var(--color-muted)'}} />
        )}
      </button>
    </div>
  );
}
