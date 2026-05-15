"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initializeOneSignal, sendTestPush } from "@/lib/onesignal";
import { notifyDetectedSound } from "@/lib/soundNotifications";

type StreamStatus =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "listening"
  | "stopping"
  | "error";

type ServerEvent =
  | {
      type: "status";
      status: string;
      message: string;
    }
  | {
      type: "debug";
      receivedBytes: number;
      samples: number;
      bufferedSamples: number;
      windowsReady: number;
    }
  | {
      type: "alert";
      alert: AccessibilityAlert;
    }
  | {
      type: "transcript";
      text: string;
      timestamp: string;
    };

export type AccessibilityAlert = {
  sound: string;
  priority: "high" | "medium" | "low";
  confidence: number;
  message: string;
  timestamp: string;
};

type AudioStreamerState = {
  status: StreamStatus;
  error: string | null;
  chunksSent: number;
  bytesSent: number;
  lastServerEvent: ServerEvent | null;
  classifierStatus: string;
  llmStatus: string;
  transcriberStatus: string;
  notificationStatus: string;
  currentAlert: AccessibilityAlert | null;
  history: AccessibilityAlert[];
  currentTranscript: string;
  transcriptHistory: Array<{ text: string; timestamp: string }>;
  sampleRate: number | null;
  waveform: number[];
};

const TARGET_SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 1;
const CHUNK_SAMPLES = TARGET_SAMPLE_RATE * CHUNK_SECONDS;
const WAVEFORM_BARS = 48;

function downsampleTo16k(input: Float32Array, inputSampleRate: number) {
  if (inputSampleRate === TARGET_SAMPLE_RATE) {
    return new Float32Array(input);
  }

  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(Math.floor((outputIndex + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;

    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += input[inputIndex] ?? 0;
      count += 1;
    }

    output[outputIndex] = count > 0 ? sum / count : 0;
  }

  return output;
}

function getRms(samples: Float32Array) {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    sum += sample * sample;
  }

  return Math.min(1, Math.sqrt(sum / samples.length) * 8);
}

export function useAudioStreamer() {
  const [state, setState] = useState<AudioStreamerState>({
    status: "idle",
    error: null,
    chunksSent: 0,
    bytesSent: 0,
    lastServerEvent: null,
    classifierStatus: "Not connected",
    llmStatus: "Not connected",
    transcriberStatus: "Not connected",
    notificationStatus: "Not connected",
    currentAlert: null,
    history: [],
    currentTranscript: "",
    transcriptHistory: [],
    sampleRate: null,
    waveform: Array.from({ length: WAVEFORM_BARS }, () => 0.05),
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingSamplesRef = useRef<Float32Array[]>([]);
  const pendingSampleCountRef = useRef(0);
  const sensitivityRef = useRef(0.75);

  const stop = useCallback(() => {
    setState((current) => ({
      ...current,
      status: current.status === "idle" ? "idle" : "stopping",
    }));

    processorRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    socketRef.current?.close();
    void audioContextRef.current?.close();

    processorRef.current = null;
    silentGainRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    socketRef.current = null;
    audioContextRef.current = null;
    pendingSamplesRef.current = [];
    pendingSampleCountRef.current = 0;

    setState((current) => ({
      ...current,
      status: "idle",
      sampleRate: null,
      waveform: Array.from({ length: WAVEFORM_BARS }, () => 0.05),
    }));
  }, []);

  const sendReadyChunks = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (pendingSampleCountRef.current >= CHUNK_SAMPLES) {
      const output = new Float32Array(CHUNK_SAMPLES);
      let offset = 0;

      while (offset < CHUNK_SAMPLES) {
        const firstBuffer = pendingSamplesRef.current[0];
        if (!firstBuffer) {
          break;
        }

        const remaining = CHUNK_SAMPLES - offset;
        const sliceLength = Math.min(remaining, firstBuffer.length);
        output.set(firstBuffer.subarray(0, sliceLength), offset);
        offset += sliceLength;

        if (sliceLength === firstBuffer.length) {
          pendingSamplesRef.current.shift();
        } else {
          pendingSamplesRef.current[0] = firstBuffer.subarray(sliceLength);
        }
      }

      pendingSampleCountRef.current -= CHUNK_SAMPLES;
      socket.send(output.buffer);

      setState((current) => ({
        ...current,
        chunksSent: current.chunksSent + 1,
        bytesSent: current.bytesSent + output.byteLength,
      }));
    }
  }, []);

  const start = useCallback(async () => {
    if (state.status !== "idle" && state.status !== "error") {
      return;
    }

    setState((current) => ({
      ...current,
      status: "requesting-permission",
      error: null,
      chunksSent: 0,
      bytesSent: 0,
      lastServerEvent: null,
      classifierStatus: "Not connected",
      llmStatus: "Not connected",
      transcriberStatus: "Not connected",
      notificationStatus: "Requesting permission",
      currentAlert: null,
      history: [],
      currentTranscript: "",
      transcriptHistory: [],
    }));

    try {
      const notificationSetup = await initializeOneSignal();
      setState((current) => ({
        ...current,
        notificationStatus: notificationSetup.ok
          ? "OneSignal ready"
          : notificationSetup.reason ?? "Push unavailable",
      }));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      setState((current) => ({ ...current, status: "connecting" }));

      const socketUrl =
        process.env.NEXT_PUBLIC_AUDIO_WS_URL ?? "ws://127.0.0.1:8000/audio";
      const socket = new WebSocket(socketUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener(
          "error",
          () => reject(new Error("Could not connect to the audio backend.")),
          { once: true },
        );
      });

      socket.send(
        JSON.stringify({
          type: "config",
          threshold: sensitivityRef.current,
        }),
      );

      socket.addEventListener("message", (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as ServerEvent;
          if (parsed.type === "alert") {
            void notifyDetectedSound(parsed.alert).then((result) => {
              if ("skipped" in result && result.skipped) {
                return;
              }

              setState((current) => ({
                ...current,
                notificationStatus: result.ok
                  ? `Push sent: ${parsed.alert.sound}${
                      result.recipients !== undefined ? ` (${result.recipients})` : ""
                    }`
                  : result.reason ?? "Push failed",
              }));
            });
          }

          setState((current) => ({
            ...current,
            lastServerEvent: parsed,
            classifierStatus:
              parsed.type === "status" && parsed.status === "classifier-ready"
                ? "YAMNet ready"
                : parsed.type === "status" &&
                    parsed.status === "classifier-unavailable"
                  ? "Unavailable"
                  : current.classifierStatus,
            llmStatus:
              parsed.type === "status" && parsed.status === "llm-ready"
                ? "LM Studio ready"
                : parsed.type === "status" && parsed.status === "llm-unavailable"
                  ? "Local fallback"
                  : current.llmStatus,
            transcriberStatus:
              parsed.type === "status" && parsed.status === "transcriber-ready"
                ? "Whisper ready"
                : parsed.type === "status" &&
                    parsed.status === "transcriber-unavailable"
                  ? "Unavailable"
                  : current.transcriberStatus,
            currentAlert:
              parsed.type === "alert" ? parsed.alert : current.currentAlert,
            history:
              parsed.type === "alert"
                ? [parsed.alert, ...current.history].slice(0, 8)
                : current.history,
            currentTranscript:
              parsed.type === "transcript" ? parsed.text : current.currentTranscript,
            transcriptHistory:
              parsed.type === "transcript"
                ? [
                    { text: parsed.text, timestamp: parsed.timestamp },
                    ...current.transcriptHistory,
                  ].slice(0, 6)
                : current.transcriptHistory,
          }));
        } catch {
          setState((current) => ({
            ...current,
            error: "Received an unreadable backend message.",
          }));
        }
      });

      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("This browser does not support Web Audio.");
      }

      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(input, audioContext.sampleRate);
        pendingSamplesRef.current.push(downsampled);
        pendingSampleCountRef.current += downsampled.length;
        sendReadyChunks();

        const rms = getRms(input);
        setState((current) => ({
          ...current,
          waveform: [...current.waveform.slice(1), Math.max(0.05, rms)],
        }));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;

      setState((current) => ({
        ...current,
        status: "listening",
        sampleRate: audioContext.sampleRate,
      }));
    } catch (error) {
      stop();
      setState((current) => ({
        ...current,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Microphone streaming could not start.",
      }));
    }
  }, [sendReadyChunks, state.status, stop]);

  useEffect(() => stop, [stop]);

  const setSensitivity = useCallback((threshold: number) => {
    sensitivityRef.current = threshold;
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "config",
          threshold,
        }),
      );
    }
  }, []);

  const sendTestAlert = useCallback(() => {
    const socket = socketRef.current;

    void sendTestPush().then((result) => {
      setState((current) => ({
        ...current,
        notificationStatus: result.ok
          ? `Test push sent${result.recipients !== undefined ? ` (${result.recipients})` : ""}`
          : result.reason ?? "Test push failed",
      }));
    });

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "test-alert",
          sound: "Siren",
          priority: "high",
          confidence: 0.91,
        }),
      );
    }
  }, []);

  return {
    ...state,
    targetSampleRate: TARGET_SAMPLE_RATE,
    start,
    stop,
    setSensitivity,
    sendTestAlert,
  };
}
