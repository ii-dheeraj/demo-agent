"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { airecruiterAgent } from "../agentConfigs/airecruiter";
import { SessionStatus } from "../types";

type PermissionState = "idle" | "prompt" | "granted" | "denied" | "error";

type DeviceInfo = {
  id: string;
  label: string;
};

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PermissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<SessionStatus>("DISCONNECTED");
  const [useRealtimeAgent, setUseRealtimeAgent] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement>(null);

  // Feature flag to prefer free browser-based Speech APIs
  const useBrowserSpeech = (process.env.NEXT_PUBLIC_USE_BROWSER_SPEECH || "").toLowerCase() === "true";
  // Feature flag to control greeting playback (disabled by default)
  const shouldPlayGreeting = (process.env.NEXT_PUBLIC_PLAY_GREETING || "").toLowerCase() === "true";
  const envAutoStart = (process.env.NEXT_PUBLIC_AUTO_START || "").toLowerCase() === "true";
  const defaultVoiceId = Number(process.env.NEXT_PUBLIC_CAMB_VOICE_ID || "");
  const showQuestion = (process.env.NEXT_PUBLIC_SHOW_QUESTION || "").toLowerCase() === "true";

  const [mics, setMics] = useState<DeviceInfo[]>([]);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string | undefined>(undefined);
  const [selectedCam, setSelectedCam] = useState<string | undefined>(undefined);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCamMenu, setShowCamMenu] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localBgVideoRef = useRef<HTMLVideoElement | null>(null);
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greetPlayedRef = useRef<boolean>(false);
  const interviewStartedRef = useRef<boolean>(false);
  const [interviewStarted, setInterviewStarted] = useState<boolean>(false);
  const lastSentLenRef = useRef<number>(0);

  // Local-only mock questions to keep the app front-end only
  const QUESTIONS: string[] = [
    "Tell me about yourself.",
    "What excites you about this role?",
    "Describe a challenging project you worked on.",
  ];
  const [qIndex, setQIndex] = useState<number>(0);

  // STT (Speech-to-Text) via Web Speech Recognition API
  const recognitionRef = useRef<any>(null);
  const [sttSupported, setSttSupported] = useState<boolean>(false);
  const [sttListening, setSttListening] = useState<boolean>(false);
  const [sttTranscript, setSttTranscript] = useState<string>("");
  const [sttInterim, setSttInterim] = useState<string>("");
  const currentTurnRef = useRef<string>("");
  const lastActivityAtRef = useRef<number>(0);
  const AUTO_ADVANCE_MS = 1800; // consider end of answer after ~1.8s of silence

  // Interview state
  const [question, setQuestion] = useState<string>("");
  const [transcript, setTranscript] = useState<Array<{ role: "interviewer" | "candidate"; text: string }>>([]);

  // OpenAI Realtime Session
  const realtimeSession = useRealtimeSession({
    onConnectionChange: (status) => {
      setRealtimeStatus(status);
      if (status === "CONNECTED" && !interviewStartedRef.current) {
        onStartInterview();
      }
    },
  });

  // which video is primary (full-screen)
  const [primary, setPrimary] = useState<"remote" | "local">("local");

  const listDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const micList = devices.filter(d => d.kind === "audioinput").map(d => ({ id: d.deviceId, label: d.label || "Microphone" }));
    const camList = devices.filter(d => d.kind === "videoinput").map(d => ({ id: d.deviceId, label: d.label || "Camera" }));
    setMics(micList);
    setCameras(camList);
    if (!selectedMic && micList[0]) setSelectedMic(micList[0].id);
    if (!selectedCam && camList[0]) setSelectedCam(camList[0].id);
  };

  // Helper: speak using browser Speech Synthesis API only (no backend)
  const speakBrowserTTS = async (text: string) => {
    try {
      const w: any = window as any;
      const synth: SpeechSynthesis | undefined = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!useBrowserSpeech || !synth || typeof w.SpeechSynthesisUtterance === "undefined") return;
      const u = new w.SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 1.03;
      u.pitch = 0.9;
      const voices = synth.getVoices?.() || [];
      const preferred = voices.find((v: any) => /en-US/i.test(v.lang) && /female|neural|f/i.test(v.name)) || voices.find((v: any) => /en-US/i.test(v.lang));
      if (preferred) u.voice = preferred;
      synth.speak(u);
    } catch {}
  };

  // Ask next question locally (front-end only)
  const askNextQuestion = async () => {
    try {
      // pause STT while asking the question to reduce feedback
      try { recognitionRef.current?.stop?.(); } catch {}
      const isLast = qIndex >= QUESTIONS.length;
      if (isLast) {
        setQuestion("Interview completed. Thank you.");
        return;
      }
      const q = QUESTIONS[qIndex];
      setQuestion(q);
      setTranscript((t) => [...t, { role: "interviewer", text: q }]);
      await speakBrowserTTS(q);
      // optionally restart STT after question if supported
      if (useBrowserSpeech && sttSupported && !sttListening) {
        startSTT();
      }
      setQIndex((i) => i + 1);
    } catch (e) {
      console.error("askNextQuestion error", e);
    }
  };

  // Start interview on explicit user action to avoid autoplay restrictions
  const onStartInterview = async () => {
    if (interviewStartedRef.current) return;
    interviewStartedRef.current = true;
    setInterviewStarted(true);
    
    if (useRealtimeAgent && realtimeStatus === "CONNECTED") {
      // Let the AI agent handle the interview
      return;
    }
    
    await askNextQuestion();
  };

  // If permissions granted and autostart enabled, start automatically
  useEffect(() => {
    if (status !== "granted") return;
    const qAuto = (searchParams?.get("autostart") || "").toLowerCase();
    const want = envAutoStart || qAuto === "1" || qAuto === "true";
    if (want && !interviewStartedRef.current) {
      // Enable realtime agent for autostart
      setUseRealtimeAgent(true);
      onStartInterview();
    }
  }, [status, envAutoStart, searchParams]);

  // Candidate indicates they are done speaking; advance to next question
  const onNextTurn = async () => {
    try {
      // Prefer currentTurnRef (this turn only); fallback to delta from sttTranscript
      const answer = (currentTurnRef.current || (sttTranscript || "").slice(lastSentLenRef.current)).trim();
      if (answer) {
        setTranscript((t) => [...t, { role: "candidate", text: answer }]);
        lastSentLenRef.current = sttTranscript.length;
        currentTurnRef.current = "";
      }
      await askNextQuestion();
    } catch {}
  };

  // Auto-advance when user is silent after speaking
  useEffect(() => {
    const id = setInterval(() => {
      if (!interviewStarted || !sttListening) return;
      if (!currentTurnRef.current) return; // nothing spoken for this turn yet
      const since = Date.now() - (lastActivityAtRef.current || 0);
      if (since > AUTO_ADVANCE_MS) {
        onNextTurn();
      }
    }, 400);
    return () => clearInterval(id);
  }, [interviewStarted, sttListening]);

  const startStream = async (opts?: { micId?: string; camId?: string; wantAudio?: boolean; wantVideo?: boolean; }) => {
    const wantAudio = opts?.wantAudio ?? micOn;
    const wantVideo = opts?.wantVideo ?? camOn;
    const constraints: MediaStreamConstraints = {
      audio: wantAudio ? { deviceId: opts?.micId ? { exact: opts.micId } : selectedMic ? { exact: selectedMic } : undefined } : false,
      video: wantVideo ? { deviceId: opts?.camId ? { exact: opts.camId } : selectedCam ? { exact: selectedCam } : undefined } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // stop previous
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      await localVideoRef.current.play().catch(() => {});
    }
    if (localBgVideoRef.current) {
      localBgVideoRef.current.srcObject = stream;
      await localBgVideoRef.current.play().catch(() => {});
    }
    // reflect toggles
    stream.getAudioTracks().forEach(t => (t.enabled = micOn));
    stream.getVideoTracks().forEach(t => (t.enabled = camOn));
  };

  const requestPermissions = async () => {
    setError(null);
    setStatus("prompt");
    try {
      await startStream({});
      await listDevices();
      setStatus("granted");
      
      // Auto-connect to realtime if enabled
      if (useRealtimeAgent) {
        await connectToRealtime();
      }
    } catch (err: any) {
      const name = err?.name || "Error";
      const message = err?.message || String(err);
      if (name === "NotAllowedError") setStatus("denied"); else setStatus("error");
      setError(`${name}: ${message}`);
    }
  };

  // Auto-connect to realtime when useRealtimeAgent is enabled
  useEffect(() => {
    if (useRealtimeAgent && status === "granted" && realtimeStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [useRealtimeAgent, status, realtimeStatus]);

  const connectToRealtime = async () => {
    try {
      await realtimeSession.connect({
        getEphemeralKey: async () => {
          const response = await fetch("/api/session");
          const data = await response.json();
          return data.client_secret.value;
        },
        initialAgents: [airecruiterAgent],
        audioElement: audioElementRef.current || undefined,
      });
    } catch (error) {
      console.error("Failed to connect to realtime:", error);
      setError("Failed to connect to AI interviewer");
    }
  };

  // timer
  useEffect(() => {
    let t: any;
    if (status === "granted") {
      t = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => t && clearInterval(t);
  }, [status]);

  useEffect(() => {
    // Auto request on mount because user clicked Start Video Interview
    requestPermissions();
    // Detect STT support
    try {
      const w: any = window as any;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      setSttSupported(!!SR);
    } catch {}
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      // cleanup audio
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }
      } catch {}
    };
  }, []);

  // Optional greeting (disabled unless NEXT_PUBLIC_PLAY_GREETING=true)
  useEffect(() => {
    if (!shouldPlayGreeting) return;
    const doPlayGreeting = async () => {
      if (greetPlayedRef.current) return;
      try {
        const w: any = window as any;
        const synth: SpeechSynthesis | undefined = typeof window !== "undefined" ? window.speechSynthesis : undefined;
        if (useBrowserSpeech && synth && typeof w.SpeechSynthesisUtterance !== "undefined") {
          const u = new w.SpeechSynthesisUtterance(
            "Hi, I'm Olivia, your AI interviewer. Thanks for joining. We'll start with a few questions about your background. Are you ready to begin?"
          );
          u.lang = "en-US";
          u.rate = 1.03;
          u.pitch = 0.8;
          const pickVoice = () => {
            const voices = synth.getVoices?.() || [];
            const preferred = voices.find((v: any) => /en-US/i.test(v.lang) && /female|neural|f/i.test(v.name)) || voices.find((v: any) => /en-US/i.test(v.lang));
            if (preferred) u.voice = preferred;
            synth.speak(u);
          };
          if (synth.getVoices && synth.getVoices().length === 0) {
            synth.onvoiceschanged = () => pickVoice();
            pickVoice();
          } else {
            pickVoice();
          }
          greetPlayedRef.current = true;
          setAutoplayBlocked(false);
          return;
        }
        // If browser speech not available, skip greeting (no backend fetch)
        greetPlayedRef.current = true;
        setAutoplayBlocked(false);
      } catch (e) {
        setAutoplayBlocked(true);
      }
    };
    if (status === "granted") {
      doPlayGreeting();
    }
  }, [status, shouldPlayGreeting, useBrowserSpeech]);

  // STT controls
  const startSTT = () => {
    try {
      const w: any = window as any;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!useBrowserSpeech || !SR) return;
      if (sttListening) return;
      const rec = new SR();
      recognitionRef.current = rec;
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event: any) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interimText += r[0].transcript;
        }
        if (finalText) {
          setSttTranscript((prev) => (prev ? prev + " " : "") + finalText);
          currentTurnRef.current = (currentTurnRef.current ? currentTurnRef.current + " " : "") + finalText;
          lastActivityAtRef.current = Date.now();
        }
        if (interimText) {
          lastActivityAtRef.current = Date.now();
        }
        setSttInterim(interimText);
      };
      rec.onerror = () => {
        setSttListening(false);
      };
      rec.onend = () => {
        setSttListening(false);
      };
      rec.start();
      setSttListening(true);
    } catch {}
  };
  const stopSTT = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
  };

  // toggle mic
  const onToggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    mediaStreamRef.current?.getAudioTracks().forEach(t => (t.enabled = next));
  };

  // toggle cam
  const onToggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    if (!next) {
      mediaStreamRef.current?.getVideoTracks().forEach(t => (t.enabled = false));
    } else {
      // ensure there is a video track (may need to restart with video)
      const hasVideo = mediaStreamRef.current?.getVideoTracks().length;
      if (!hasVideo) {
        await startStream({ wantVideo: true });
      } else {
        mediaStreamRef.current?.getVideoTracks().forEach(t => (t.enabled = true));
      }
    }
  };

  const onPickMic = async (id: string) => {
    setSelectedMic(id);
    try { await startStream({ micId: id }); } catch {}
    setShowMicMenu(false);
  };
  const onPickCam = async (id: string) => {
    setSelectedCam(id);
    try { await startStream({ camId: id }); } catch {}
    setShowCamMenu(false);
  };

  const hangUp = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    router.push("/");
  };

  const mmss = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(1, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <main className="min-h-screen bg-black p-4 md:p-6">
      <div className="relative w-full max-w-full mx-auto h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black">
        {/* Primary full-bleed video */}
        {primary === "remote" ? (
          <video
            ref={avatarVideoRef}
            src="https://storage.googleapis.com/ai_recruiter_bucket_prod/assets/videos/olivia_character_no_audio.mp4"
            className="w-full h-full object-contain bg-black"
            autoPlay
            loop
            muted
            playsInline
            onClick={() => setPrimary("local")}
          />
        ) : (
          <video
            ref={localBgVideoRef}
            className="w-full h-full object-contain bg-black"
            autoPlay
            muted
            playsInline
            onClick={() => setPrimary("remote")}
          />
        )}

        {/* PiP bottom-left - shows the non-primary video */}
        <div className="absolute bottom-24 left-6 sm:left-10">
          <button
            className="relative w-40 sm:w-56 rounded-xl overflow-hidden shadow-lg ring-2 ring-white/60 bg-black/60 backdrop-blur group"
            onClick={() => setPrimary(primary === "remote" ? "local" : "remote")}
            aria-label="Swap videos"
          >
            {primary === "remote" ? (
              <video
                ref={localVideoRef}
                className="w-full aspect-video object-cover"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <video
                src="https://storage.googleapis.com/ai_recruiter_bucket_prod/assets/videos/olivia_character_no_audio.mp4"
                className="w-full aspect-video object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            )}
            <div className="absolute bottom-2 left-2 text-xs text-white/90 opacity-90 group-hover:opacity-100">
              {primary === "remote" ? "You" : "olivia"}
            </div>
          </button>
        </div>

        {/* Bottom-center control bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-3">
            {/* Mic group */}
            <div className="relative">
              <div className="flex items-center overflow-hidden rounded-full bg-white/80 backdrop-blur shadow">
                <button
                  onClick={onToggleMic}
                  className={`px-4 py-3 text-gray-800 ${micOn ? "" : "opacity-60"}`}
                  aria-label="Toggle microphone"
                >
                  <span className="i">🎙️</span>
                </button>
                <button
                  onClick={() => setShowMicMenu((v) => !v)}
                  className="px-3 py-3 text-gray-700 border-l border-gray-200"
                  aria-label="Select microphone"
                >
                  ▾
                </button>
              </div>
              {showMicMenu && (
                <div className="absolute bottom-14 left-0 min-w-48 rounded-lg bg-white shadow-lg ring-1 ring-gray-200 p-2">
                  {mics.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No mics</div>}
                  {mics.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onPickMic(d.id)}
                      className={`block w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 ${selectedMic === d.id ? "font-semibold" : ""}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Camera group */}
            <div className="relative">
              <div className="flex items-center overflow-hidden rounded-full bg-white/80 backdrop-blur shadow">
                <button
                  onClick={onToggleCam}
                  className={`px-4 py-3 text-gray-800 ${camOn ? "" : "opacity-60"}`}
                  aria-label="Toggle camera"
                >
                  📷
                </button>
                <button
                  onClick={() => setShowCamMenu((v) => !v)}
                  className="px-3 py-3 text-gray-700 border-l border-gray-200"
                  aria-label="Select camera"
                >
                  ▾
                </button>
              </div>
              {showCamMenu && (
                <div className="absolute bottom-14 left-0 min-w-48 rounded-lg bg-white shadow-lg ring-1 ring-gray-200 p-2">
                  {cameras.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No cameras</div>}
                  {cameras.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onPickCam(d.id)}
                      className={`block w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 ${selectedCam === d.id ? "font-semibold" : ""}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hang up */}
            <button
              onClick={hangUp}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
              aria-label="End call"
            >
              ✕
            </button>
            {/* Fallback play button if autoplay blocked */}
            {shouldPlayGreeting && autoplayBlocked && (
              <button
                onClick={async () => {
                  try {
                    // Retry using browser speech only (no backend)
                    if (useBrowserSpeech && typeof window !== "undefined" && (window as any).speechSynthesis) {
                      const w: any = window as any;
                      const u = new w.SpeechSynthesisUtterance(
                        "Hi, I'm Olivia, your AI interviewer. Thanks for joining. We'll start with a few questions about your background. Are you ready to begin?"
                      );
                      u.lang = "en-US";
                      u.rate = 1.03;
                      u.pitch = 0.8;
                      (window as any).speechSynthesis.speak(u);
                    }
                    greetPlayedRef.current = true;
                    setAutoplayBlocked(false);
                  } catch {}
                }}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-white text-sm font-semibold shadow hover:bg-emerald-700"
                aria-label="Play greeting"
                title="Play greeting"
              >
                ▶ Play Greeting
              </button>
            )}
            {/* STT controls (only if browser speech enabled and supported) */}
            {useBrowserSpeech && sttSupported && (
              <div className="ml-2 inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full px-3 py-2 text-sm text-gray-800 shadow">
                <button
                  onClick={sttListening ? stopSTT : startSTT}
                  className={`px-3 py-1 rounded-full ${sttListening ? "bg-amber-500 text-white" : "bg-gray-200"}`}
                  aria-label="Toggle speech recognition"
                >
                  {sttListening ? "Stop STT" : "Start STT"}
                </button>
                {interviewStarted && (
                  <button
                    onClick={onNextTurn}
                    className="px-3 py-1 rounded-full bg-emerald-600 text-white"
                    aria-label="Next question"
                    title="Send your answer and get the next question"
                  >
                    Next
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Start Interview button (only visible until started) */}
        {!interviewStarted && status === "granted" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => setUseRealtimeAgent(!useRealtimeAgent)}
                className={`px-3 py-1.5 text-xs rounded-full ${useRealtimeAgent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {useRealtimeAgent ? 'AI Agent: ON' : 'AI Agent: OFF'}
              </button>
              <div className={`px-2 py-1 text-xs rounded-full ${realtimeStatus === 'CONNECTED' ? 'bg-green-200 text-green-800' : realtimeStatus === 'CONNECTING' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600'}`}>
                {realtimeStatus}
              </div>
            </div>
            <button
              onClick={onStartInterview}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-white text-sm font-semibold shadow hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              ▶ Start Interview
            </button>
          </div>
        )}

        {/* Right side timer and name */}
        <div className="absolute bottom-8 right-6 sm:right-8 flex flex-col items-end gap-2">
          <div className="px-2 py-1 rounded-md bg-black/60 text-white text-sm">{mmss(elapsed)}</div>
          <div className="px-2 py-1 rounded-md bg-black/60 text-white text-sm">olivia</div>
        </div>
        {/* Question bubble removed per request: agent will speak questions without on-screen text */}
        {/* Transcript panel (if using browser STT) */}
        {useBrowserSpeech && (
          <div className="absolute top-4 left-4 right-4 mx-4 sm:max-w-xl sm:left-6 sm:right-auto">
            <div className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-black/10 p-3 text-sm text-gray-800 max-h-40 overflow-auto">
              <div className="font-semibold mb-1">Transcript</div>
              <div className="whitespace-pre-wrap">
                {sttTranscript || "(no transcript yet)"}
                {sttInterim && <span className="opacity-60"> {sttInterim}</span>}
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden audio element for realtime */}
        <audio ref={audioElementRef} autoPlay />
      </div>
    </main>
  );
}
