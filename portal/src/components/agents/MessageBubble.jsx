import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, Check, Loader2, X, AlertCircle } from 'lucide-react';

const STATUS_META = {
  pending: { icon: Loader2, className: 'animate-spin text-neutral-400', label: 'Pending' },
  running: { icon: Loader2, className: 'animate-spin text-neutral-400', label: 'Running' },
  in_progress: { icon: Loader2, className: 'animate-spin text-neutral-400', label: 'In progress' },
  completed: { icon: Check, className: 'text-emerald-500', label: 'Completed' },
  success: { icon: Check, className: 'text-emerald-500', label: 'Done' },
  failed: { icon: X, className: 'text-red-500', label: 'Failed' },
  error: { icon: AlertCircle, className: 'text-red-500', label: 'Error' },
};

function formatToolName(name) {
  return (name || '').replace(/_/g, ' ');
}

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || 'pending';
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;

  const failed = status === 'failed' || status === 'error';
  let parsedResults = toolCall.results;
  if (typeof parsedResults === 'string') {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  if (parsedResults && typeof parsedResults === 'object' && parsedResults.success === false) {
    // treat as failed
  }

  let parsedArgs = toolCall.arguments_string;
  if (typeof parsedArgs === 'string') {
    try { parsedArgs = JSON.parse(parsedArgs); } catch { /* keep raw */ }
  }

  const stateLabel = failed
    ? (proj.error_label || meta.label)
    : (status === 'pending' || status === 'running' || status === 'in_progress')
    ? (proj.active_label || meta.label)
    : (proj.label || meta.label);

  return (
    <div className="mt-2 text-xs border border-neutral-200 rounded-lg bg-neutral-50 overflow-hidden">
      <button
        onClick={() => !hideDetails && setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full px-3 py-2 ${hideDetails ? '' : 'hover:bg-neutral-100'} transition`}
      >
        {!hideDetails && (expanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />)}
        <Icon size={14} className={meta.className} />
        <span className="font-medium text-neutral-700 capitalize">{formatToolName(toolCall.name)}</span>
        <span className="text-neutral-400">·</span>
        <span className={failed ? 'text-red-500' : 'text-neutral-500'}>{stateLabel}</span>
      </button>
      {expanded && !hideDetails && (
        <div className="px-3 pb-3 space-y-2">
          {parsedArgs !== undefined && (
            <div>
              <div className="text-neutral-400 mb-1">Parameters</div>
              <pre className="bg-white border border-neutral-200 rounded p-2 overflow-x-auto text-[11px] text-neutral-700">
                {JSON.stringify(parsedArgs, null, 2)}
              </pre>
            </div>
          )}
          {parsedResults !== undefined && (
            <div>
              <div className="text-neutral-400 mb-1">Result</div>
              <pre className="bg-white border border-neutral-200 rounded p-2 overflow-x-auto text-[11px] text-neutral-700">
                {typeof parsedResults === 'string' ? parsedResults : JSON.stringify(parsedResults, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={`max-w-[80%] ${isUser ? '' : 'w-full'}`}>
        {message.content && (isUser ? (
          <div className="bg-neutral-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm">
            {message.content}
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-neutral-800 prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ))}
        {message.tool_calls?.map((toolCall, idx) => (
          <FunctionDisplay key={idx} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}