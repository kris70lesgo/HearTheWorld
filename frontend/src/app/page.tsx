"use client";

import {
  Activity,
  BellRing,
  Captions,
  History,
  Mic,
  OctagonAlert,
  Play,
  Radio,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Volume2,
  Waves,
} from "lucide-react";
import { useMemo, useState } from "react";
import Orb from "@/components/Orb/Orb";
import { useAudioStreamer } from "@/hooks/useAudioStreamer";

export default function Home() {
  const {
    status,
    error,
    chunksSent,
    bytesSent,
    lastServerEvent,
    classifierStatus,
    llmStatus,
    transcriberStatus,
    notificationStatus,
    currentAlert,
    history,
    currentTranscript,
    transcriptHistory,
    sampleRate,
    targetSampleRate,
    start,
    stop,
    setSensitivity: setBackendSensitivity,
    sendTestAlert,
  } = useAudioStreamer();
  const [sensitivity, setSensitivity] = useState(75);

  const isListening = status === "listening";
  const lastBackendText =
    lastServerEvent?.type === "debug"
      ? `${lastServerEvent.receivedBytes.toLocaleString()} bytes`
      : lastServerEvent?.type === "status"
        ? lastServerEvent.message
        : lastServerEvent?.type === "alert"
          ? "Alert received"
          : "No event";

  const statusLabel = useMemo(() => {
    const labels: Record<typeof status, string> = {
      idle: "Ready",
      "requesting-permission": "Mic permission",
      connecting: "Connecting",
      listening: "Listening",
      stopping: "Stopping",
      error: "Needs attention",
    };

    return labels[status];
  }, [status]);

  const transcriptText = currentTranscript || "Say hello. Local Whisper captions will appear here.";

  return (
    <main
      className={`relative h-screen overflow-hidden bg-[#dfe6f5] p-3 text-[#253026] ${
        currentAlert?.priority === "high" ? "screen-flash" : ""
      }`}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      <section className="relative mx-auto grid h-full max-w-[1480px] grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-[26px] border border-white/75 bg-white/20 p-3 shadow-[0_28px_90px_rgba(73,86,111,0.24)] backdrop-blur-3xl">
        <SideRail isListening={isListening} />

        <div className="grid min-h-0 grid-rows-[72px_minmax(0,1fr)] gap-3">
          <header className="glass-panel compact-header grid grid-cols-[minmax(250px,0.9fr)_minmax(240px,0.8fr)_auto] items-center gap-3 px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/80 bg-white/55 shadow-inner">
                <Volume2 className="h-5 w-5 text-[#344135]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6d7f91]">
                  HearTheWorld
                </p>
                <h1 className="font-display truncate text-[32px] font-bold leading-none">
                  Sound Console
                </h1>
              </div>
            </div>

            <div className="glass-field flex min-w-0 items-center gap-2 px-4 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-[#617080]" />
              <span className="truncate text-sm font-bold text-[#617080]">
                Captions, alerts, environmental cues
              </span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <StatusPill active={isListening} label={statusLabel} />
              <button className="icon-button compact-icon" aria-label="Settings" type="button">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-[minmax(0,1.05fr)_minmax(360px,0.78fr)] gap-3">
            <section className="grid min-h-0 content-start grid-rows-[360px_190px] gap-3">
              <section className="glass-panel grid min-h-0 grid-cols-[minmax(0,1fr)_220px] items-center gap-4 p-4">
                <div className="min-w-0">
                  <SectionTitle icon={OctagonAlert} label="Current alert" />
                  <h2 className="mt-3 line-clamp-3 text-[28px] font-black leading-tight tracking-normal">
                    {currentAlert?.message ??
                      (isListening ? "Listening for important sounds" : "Ready to start monitoring")}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-[13px] font-bold leading-5 text-[#5b675d]">
                    {currentAlert
                      ? `${currentAlert.sound} at ${Math.round(
                          currentAlert.confidence * 100,
                        )}% confidence.`
                      : "Real-time household, weather, outdoor, and danger sounds with live speech captions."}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <TinyStat label="Chunks" value={chunksSent.toString()} />
                    <TinyStat label="Streamed" value={bytesSent.toLocaleString()} />
                    <TinyStat
                      label="Rate"
                      value={
                        sampleRate
                          ? `${targetSampleRate / 1000}k`
                          : `${targetSampleRate / 1000}k`
                      }
                    />
                  </div>
                </div>

                <div className="orb-field pointer-events-none relative flex aspect-square h-[220px] w-[220px] items-center justify-center overflow-visible">
                  <Orb
                    hue={isListening ? 135 : 18}
                    hoverIntensity={0}
                    rotateOnHover={isListening}
                    forceHoverState={isListening}
                    backgroundColor="rgb(236, 239, 247)"
                  />
                </div>
              </section>

              <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-3">
                <GlassCard className="controls-card">
                  <SectionTitle icon={Captions} label="Live captions" />
                  <p className="mt-2 line-clamp-3 text-[19px] font-black leading-snug tracking-normal">
                    {transcriptText}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <MiniPill label={isListening ? "Listening" : "Idle"} />
                    <MiniPill label={transcriberStatus} />
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle icon={SlidersHorizontal} label="Controls" />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="control-button control-start"
                      onClick={start}
                      disabled={status !== "idle" && status !== "error"}
                      type="button"
                    >
                      <Play className="h-4 w-4" />
                      Start
                    </button>
                    <button
                      className="control-button control-stop"
                      onClick={stop}
                      disabled={status === "idle"}
                      type="button"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </button>
                  </div>
                  <button
                    className="control-button control-neutral mt-2 w-full"
                    disabled={!isListening}
                    onClick={sendTestAlert}
                    type="button"
                  >
                    <BellRing className="h-4 w-4" />
                    Test alert
                  </button>
                  <label className="mt-3 block">
                    <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[#63707c]">
                      Sensitivity
                      <span>{sensitivity}%</span>
                    </span>
                    <input
                      className="mt-2 w-full accent-[#6c63ff]"
                      max="95"
                      min="50"
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setSensitivity(nextValue);
                        setBackendSensitivity(nextValue / 100);
                      }}
                      type="range"
                      value={sensitivity}
                    />
                  </label>
                </GlassCard>
              </div>
            </section>

            <aside className="grid min-h-0 content-start grid-rows-[84px_84px_220px_190px] gap-3">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={Activity} label="Bytes" value={bytesSent.toLocaleString()} />
                <MetricCard icon={Radio} label="Chunks" value={chunksSent.toString()} />
              </div>

              <MetricCard
                icon={Waves}
                label="Audio rate"
                value={
                  sampleRate
                    ? `${sampleRate.toLocaleString()} -> ${targetSampleRate.toLocaleString()}`
                    : `Target ${targetSampleRate.toLocaleString()}`
                }
              />

              <GlassCard>
                <SectionTitle icon={Sparkles} label="Services" />
                <div className="mt-3 grid gap-2">
                  <ServiceRow label="Backend" value={lastBackendText} />
                  <ServiceRow label="Classifier" value={classifierStatus} />
                  <ServiceRow label="Writer" value={llmStatus} />
                  <ServiceRow label="Captions" value={transcriberStatus} />
                  <ServiceRow label="Push" value={notificationStatus} />
                </div>
              </GlassCard>

              <div className="grid min-h-0 grid-cols-2 gap-3 overflow-hidden">
                <GlassCard>
                  <SectionTitle icon={History} label="Sounds" />
                  <div className="mt-2 grid gap-1.5 overflow-hidden">
                    {(history.length > 0
                      ? history.slice(0, 4)
                      : [
                          { sound: isListening ? "Audio stream" : "Waiting", priority: statusLabel },
                          { sound: "Door and knock", priority: "Enabled" },
                          { sound: "Weather", priority: "Enabled" },
                        ]
                    ).map((item, index) => (
                      <HistoryRow
                        key={`${"timestamp" in item ? item.timestamp : index}-${"sound" in item ? item.sound : index}`}
                        label={"sound" in item ? item.sound : "Sound"}
                        value={
                          "confidence" in item
                            ? `${item.priority} ${Math.round(item.confidence * 100)}%`
                            : item.priority
                        }
                      />
                    ))}
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionTitle icon={Captions} label="Captions" />
                  <div className="mt-2 grid gap-1.5 overflow-hidden">
                    {transcriptHistory.length > 0 ? (
                      transcriptHistory.slice(0, 3).map((item) => (
                        <p
                          className="line-clamp-2 rounded-2xl bg-white/45 px-3 py-2 text-xs font-bold leading-5 text-[#394437]"
                          key={`${item.timestamp}-${item.text}`}
                        >
                          {item.text}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs font-bold leading-5 text-[#647064]">
                        Spoken words appear here after Whisper transcribes a phrase.
                      </p>
                    )}
                  </div>
                </GlassCard>
              </div>
            </aside>
          </div>
        </div>

        {error ? (
          <div
            className="fixed bottom-4 left-1/2 z-20 w-[min(92vw,720px)] -translate-x-1/2 rounded-3xl border border-[#f0988c]/70 bg-white/80 p-3 text-sm font-bold text-[#a93429] shadow-2xl backdrop-blur-xl"
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SideRail({ isListening }: { isListening: boolean }) {
  const items = [Mic, Activity, Captions, BellRing, Settings];

  return (
    <nav className="glass-panel flex flex-col items-center justify-between py-4">
      <div className="grid gap-3">
        {items.map((Icon, index) => (
          <button
            aria-label={`Navigation ${index + 1}`}
            className={`icon-button ${
              index === 0 && isListening ? "bg-white/80 text-[#6c63ff]" : ""
            }`}
            key={Icon.displayName ?? index}
            type="button"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <span className="h-10 w-1 rounded-full bg-white/70" />
    </nav>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="glass-field flex items-center gap-2 px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#4fb477]" : "bg-[#f08a71]"}`} />
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#344135]">
        {label}
      </span>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: typeof Activity;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/70 shadow-inner">
        <Icon className="h-4 w-4 text-[#6c63ff]" />
      </span>
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#667383]">
        {label}
      </span>
    </div>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`glass-panel min-h-0 p-4 ${className}`}>{children}</section>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <GlassCard>
      <div className="flex h-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6f7a87]">
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-black tracking-normal text-[#2c372e]">
            {value}
          </p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/70">
          <Icon className="h-4 w-4 text-[#6c63ff]" />
        </span>
      </div>
    </GlassCard>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/45 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#748091]">
        {label}
      </p>
      <p className="truncate text-sm font-black text-[#2c372e]">{value}</p>
    </div>
  );
}

function MiniPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-white/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#627080]">
      {label}
    </span>
  );
}

function ServiceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/45 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#687684]">
        {label}
      </span>
      <span className="truncate text-right text-xs font-black text-[#2c372e]">
        {value}
      </span>
    </div>
  );
}

function HistoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/45 px-3 py-2">
      <span className="truncate text-sm font-black text-[#2f3a30]">{label}</span>
      <span className="shrink-0 text-right text-[10px] font-black uppercase tracking-[0.12em] text-[#6a7582]">
        {value}
      </span>
    </div>
  );
}
