"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PermissionState = "idle" | "prompt" | "granted" | "denied" | "error";

type DeviceInfo = {
  id: string;
  label: string;
};

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PermissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);

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
    } catch (err: any) {
      const name = err?.name || "Error";
      const message = err?.message || String(err);
      if (name === "NotAllowedError") setStatus("denied"); else setStatus("error");
      setError(`${name}: ${message}`);
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
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

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
          </div>
        </div>

        {/* Right side timer and name */}
        <div className="absolute bottom-8 right-6 sm:right-8 flex flex-col items-end gap-2">
          <div className="px-2 py-1 rounded-md bg-black/60 text-white text-sm">{mmss(elapsed)}</div>
          <div className="px-2 py-1 rounded-md bg-black/60 text-white text-sm">olivia</div>
        </div>
      </div>
    </main>
  );
}
