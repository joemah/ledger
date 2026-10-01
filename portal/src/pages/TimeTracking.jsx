import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Play, Square, Plus, Pencil, Trash2, Clock, Check, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';

function formatDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const EMPTY_MANUAL = {
  description: '', client_id: '', project: '',
  duration_minutes: '', hourly_rate: '', date: new Date().toISOString().slice(0, 10),
};

export default function TimeTracking() {
  const [entries, setEntries] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [filterClient, setFilterClient] = useState('all');
  const [stats, setStats] = useState({ totalHours: 0, billableValue: 0, unbilledHours: 0, unbilledValue: 0, thisWeek: 0 });

  const [timerDesc, setTimerDesc] = useState('');
  const [timerClient, setTimerClient] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerRate, setTimerRate] = useState('');
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const loadAll = async () => {
    try {
      const [entriesRes, clientsRes, runningEntry, unbilled] = await Promise.all([
        api.entities.TimeEntry.filter({}, { sort: '-created_date', limit: 200 }),
        api.entities.Client.filter({}, { sort: 'name', limit: 200 }),
        api.entities.TimeEntry.running(),
        api.entities.TimeEntry.unbilled(),
      ]);
      const items = entriesRes.items || [];
      setEntries(items);
      setClients(clientsRes.items || []);
      setRunning(runningEntry);
      if (runningEntry?.start_time) {
        setElapsed(Date.now() - new Date(runningEntry.start_time).getTime());
        setTimerDesc(runningEntry.description || '');
        setTimerClient(runningEntry.client_id || '');
        setTimerProject(runningEntry.project || '');
        setTimerRate(runningEntry.hourly_rate?.toString() || '');
      }
      const totalHours = items.reduce((s, e) => s + (e.duration_minutes || 0) / 60, 0);
      const billableValue = items.reduce((s, e) => s + (e.duration_minutes || 0) / 60 * (e.hourly_rate || 0), 0);
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const thisWeek = items
        .filter((e) => e.start_time && new Date(e.start_time) >= weekStart)
        .reduce((s, e) => s + (e.duration_minutes || 0) / 60, 0);
      setStats({
        totalHours,
        billableValue,
        unbilledHours: unbilled.total_hours || 0,
        unbilledValue: unbilled.total_value || 0,
        thisWeek,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      if (running.start_time) {
        setElapsed(Date.now() - new Date(running.start_time).getTime());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const handleStart = async () => {
    if (!timerDesc) return;
    setStarting(true);
    try {
      const client = clients.find((c) => c.id === timerClient);
      await api.entities.TimeEntry.start({
        description: timerDesc,
        client_id: timerClient || null,
        client_name: client?.name || null,
        project: timerProject || null,
        hourly_rate: timerRate ? parseFloat(timerRate) : 0,
      });
      window.dispatchEvent(new CustomEvent('timer-changed'));
      await loadAll();
    } catch (e) {
      console.error(e);
    }
    setStarting(false);
  };

  const handleStop = async () => {
    if (!running) return;
    setStopping(true);
    try {
      await api.entities.TimeEntry.stop(running.id);
      setRunning(null);
      setElapsed(0);
      setTimerDesc('');
      setTimerProject('');
      window.dispatchEvent(new CustomEvent('timer-changed'));
      await loadAll();
    } catch (e) {
      console.error(e);
    }
    setStopping(false);
  };

  const handleSaveManual = async () => {
    if (!manualForm.description || !manualForm.duration_minutes) return;
    const client = clients.find((c) => c.id === manualForm.client_id);
    try {
      await api.entities.TimeEntry.create({
        description: manualForm.description,
        client_id: manualForm.client_id || null,
        client_name: client?.name || null,
        project: manualForm.project || null,
        duration_minutes: parseFloat(manualForm.duration_minutes),
        hourly_rate: manualForm.hourly_rate ? parseFloat(manualForm.hourly_rate) : 0,
        start_time: manualForm.date,
        end_time: manualForm.date,
        billable: true,
        invoiced: false,
      });
      setShowManual(false);
      setManualForm(EMPTY_MANUAL);
      loadAll();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.entities.TimeEntry.delete(id);
      loadAll();
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      description: entry.description || '',
      project: entry.project || '',
      duration_minutes: entry.duration_minutes?.toString() || '',
      hourly_rate: entry.hourly_rate?.toString() || '',
      client_id: entry.client_id || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm) return;
    try {
      await api.entities.TimeEntry.update(editingId, {
        ...editForm,
        duration_minutes: parseFloat(editForm.duration_minutes) || 0,
        hourly_rate: parseFloat(editForm.hourly_rate) || 0,
      });
      setEditingId(null);
      setEditForm(null);
      loadAll();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filterClient === 'all' ? entries : entries.filter((e) => e.client_id === filterClient);

  const statCards = [
    { label: 'Total Hours', value: `${stats.totalHours.toFixed(1)}h`, sub: 'All time' },
    { label: 'This Week', value: `${stats.thisWeek.toFixed(1)}h`, sub: 'Tracked this week' },
    { label: 'Unbilled Value', value: formatCurrency(stats.unbilledValue), sub: `${stats.unbilledHours.toFixed(1)}h unbilled` },
    { label: 'Total Billable', value: formatCurrency(stats.billableValue), sub: 'All billable time' },
  ];

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Time Tracking</h1>
          <p className="text-sm text-neutral-500 mt-1">Track billable hours and convert them to invoices</p>
        </div>
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-2 px-5 py-2.5 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 transition"
        >
          <Plus size={18} />
          Manual Entry
        </button>
      </div>

      {/* Timer Card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-neutral-700" />
          <h2 className="text-sm font-semibold text-neutral-900">Timer</h2>
          {running && (
            <span className="ml-2 flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Running
            </span>
          )}
        </div>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-4">
            <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">What are you working on?</label>
            <input
              type="text"
              value={timerDesc}
              onChange={(e) => setTimerDesc(e.target.value)}
              disabled={!!running}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 disabled:bg-neutral-50"
              placeholder="e.g. Backend API development"
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Client</label>
            <select
              value={timerClient}
              onChange={(e) => setTimerClient(e.target.value)}
              disabled={!!running}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 bg-white disabled:bg-neutral-50"
            >
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Project</label>
            <input
              type="text"
              value={timerProject}
              onChange={(e) => setTimerProject(e.target.value)}
              disabled={!!running}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 disabled:bg-neutral-50"
              placeholder="Project name"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Rate (hr)</label>
            <input
              type="number"
              step="0.01"
              value={timerRate}
              onChange={(e) => setTimerRate(e.target.value)}
              disabled={!!running}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 disabled:bg-neutral-50"
              placeholder="0.00"
            />
          </div>
          <div className="col-span-1">
            {running ? (
              <button
                onClick={handleStop}
                disabled={stopping}
                className="w-full flex items-center justify-center px-3 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={starting || !timerDesc}
                className="w-full flex items-center justify-center px-3 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50"
              >
                <Play size={16} fill="currentColor" />
              </button>
            )}
          </div>
        </div>
        {running && (
          <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
            <div className="text-sm text-neutral-500">
              Tracking: <span className="font-medium text-neutral-900">{running.description}</span>
              {running.client_name && <span> · {running.client_name}</span>}
            </div>
            <div className="text-3xl font-mono font-semibold tabular-nums text-neutral-900">{formatElapsed(elapsed)}</div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="text-xs uppercase tracking-wider text-neutral-400">{card.label}</div>
            <div className="text-2xl font-semibold text-neutral-900 mt-2">{card.value}</div>
            <div className="text-xs text-neutral-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Client filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterClient('all')}
          className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
            filterClient === 'all' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          All Clients
        </button>
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterClient(c.id)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
              filterClient === c.id ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Entries table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Clock size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-400 mb-4">No time entries yet</p>
            <p className="text-sm text-neutral-400">Start a timer above or add a manual entry</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Description</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Client</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Project</th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Date</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Duration</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Rate</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Total</th>
                <th className="text-center text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Status</th>
                <th className="text-right text-xs uppercase tracking-wider text-neutral-400 px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition">
                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">{entry.description}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{entry.client_name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-neutral-500">{entry.project || '—'}</td>
                  <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(entry.start_time)}</td>
                  <td className="px-6 py-4 text-sm text-neutral-900 text-right font-medium">{formatDuration(entry.duration_minutes)}</td>
                  <td className="px-6 py-4 text-sm text-neutral-500 text-right">{entry.hourly_rate ? formatCurrency(entry.hourly_rate) : '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-neutral-900 text-right">
                    {formatCurrency((entry.duration_minutes || 0) / 60 * (entry.hourly_rate || 0))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {entry.invoiced ? (
                      <Check size={16} className="inline text-emerald-600" />
                    ) : entry.end_time ? (
                      <span className="text-xs text-amber-600 font-medium">Unbilled</span>
                    ) : (
                      <span className="text-xs text-blue-600 font-medium flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Running
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(entry)} className="p-1.5 text-neutral-400 hover:text-neutral-900 transition" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-neutral-400 hover:text-red-600 transition" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowManual(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Add Manual Time Entry</h2>
              <button onClick={() => setShowManual(false)} className="text-neutral-400 hover:text-neutral-900">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Description</label>
                <input type="text" value={manualForm.description} onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" placeholder="What did you work on?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Client</label>
                  <select value={manualForm.client_id} onChange={(e) => setManualForm({ ...manualForm, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 bg-white">
                    <option value="">No client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Project</label>
                  <input type="text" value={manualForm.project} onChange={(e) => setManualForm({ ...manualForm, project: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" placeholder="Project name" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Duration (min)</label>
                  <input type="number" step="1" value={manualForm.duration_minutes} onChange={(e) => setManualForm({ ...manualForm, duration_minutes: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" placeholder="90" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Rate (hr)</label>
                  <input type="number" step="0.01" value={manualForm.hourly_rate} onChange={(e) => setManualForm({ ...manualForm, hourly_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Date</label>
                  <input type="date" value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3">
              <button onClick={() => setShowManual(false)} className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition">Cancel</button>
              <button onClick={handleSaveManual} disabled={!manualForm.description || !manualForm.duration_minutes}
                className="px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-50">Add Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setEditingId(null); setEditForm(null); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Edit Time Entry</h2>
              <button onClick={() => { setEditingId(null); setEditForm(null); }} className="text-neutral-400 hover:text-neutral-900">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Description</label>
                <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Project</label>
                <input type="text" value={editForm.project} onChange={(e) => setEditForm({ ...editForm, project: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Duration (min)</label>
                  <input type="number" step="1" value={editForm.duration_minutes} onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-neutral-400 font-medium block mb-1.5">Rate (hr)</label>
                  <input type="number" step="0.01" value={editForm.hourly_rate} onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setEditForm(null); }} className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}