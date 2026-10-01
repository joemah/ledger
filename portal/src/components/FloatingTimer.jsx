import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Clock, Square } from 'lucide-react';

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function FloatingTimer() {
  const [running, setRunning] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);

  const fetchRunning = async () => {
    try {
      const entry = await api.entities.TimeEntry.running();
      setRunning(entry);
      if (entry?.start_time) {
        setElapsed(Date.now() - new Date(entry.start_time).getTime());
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchRunning();
    const handler = () => fetchRunning();
    window.addEventListener('timer-changed', handler);
    return () => window.removeEventListener('timer-changed', handler);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      if (running.start_time) {
        setElapsed(Date.now() - new Date(running.start_time).getTime());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const handleStop = async () => {
    if (!running) return;
    setStopping(true);
    try {
      await api.entities.TimeEntry.stop(running.id);
      setRunning(null);
      setElapsed(0);
      window.dispatchEvent(new CustomEvent('timer-changed'));
    } catch (e) {
      console.error(e);
    }
    setStopping(false);
  };

  if (!running) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 no-print">
      <div className="bg-neutral-900 text-white rounded-xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[340px]">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <Clock size={20} className="animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/50 uppercase tracking-wider">Timer Running</div>
          <div className="text-sm font-medium truncate">{running.description || 'Untitled'}</div>
          {running.client_name && <div className="text-xs text-white/40 truncate">{running.client_name}</div>}
        </div>
        <div className="text-2xl font-mono font-semibold tabular-nums">{formatElapsed(elapsed)}</div>
        <button
          onClick={handleStop}
          disabled={stopping}
          className="flex items-center gap-1.5 px-3 py-2 bg-white text-neutral-900 rounded-lg text-sm font-medium hover:bg-neutral-100 transition disabled:opacity-50 shrink-0"
        >
          <Square size={14} fill="currentColor" />
          Stop
        </button>
      </div>
    </div>
  );
}