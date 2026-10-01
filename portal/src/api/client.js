/**
 * ProInvoice API client.
 *
 * Talks to the FastAPI + PostgreSQL backend.
 * Set VITE_API_URL to point at the backend:
 *   VITE_API_URL=http://localhost:8000
 * Leave it empty to use same-origin relative URLs (Docker/nginx or the Vite dev proxy).
 */

// Empty string = relative URLs (Docker/nginx proxy). Undefined = local dev fallback.
const API_BASE = (import.meta.env?.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

// ─── Token management ──────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('access_token');
}

function setToken(token) {
  localStorage.setItem('access_token', token);
}

function clearToken() {
  localStorage.removeItem('access_token');
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiCall(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const body = isFormData
    ? options.body
    : options.body
    ? JSON.stringify(serialize(options.body))
    : undefined;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, body });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      errorData = { detail: res.statusText };
    }
    const err = { status: res.status, message: errorData.detail || res.statusText, data: errorData };
    throw err;
  }

  // Some endpoints return no content
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Serialize Date objects to ISO date strings for the API
function serialize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString().slice(0, 10);
  if (Array.isArray(obj)) return obj.map(serialize);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serialize(v);
    return out;
  }
  return obj;
}

function buildQueryString(query = {}, opts = {}) {
  const params = new URLSearchParams();
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.limit) params.set('limit', opts.limit);
  if (query && Object.keys(query).length > 0) {
    params.set('filter', JSON.stringify(query));
  }
  return params.toString();
}

// ─── Entity factory ────────────────────────────────────────────────────────────

function createEntity(resource) {
  return {
    filter: async (query = {}, opts = {}) => {
      const qs = buildQueryString(query, opts);
      return apiCall(`/api/${resource}?${qs}`);
    },
    get: async (id) => apiCall(`/api/${resource}/${id}`),
    create: async (data) => apiCall(`/api/${resource}`, { method: 'POST', body: data }),
    update: async (id, data) => apiCall(`/api/${resource}/${id}`, { method: 'PUT', body: data }),
    delete: async (id) => apiCall(`/api/${resource}/${id}`, { method: 'DELETE' }),
  };
}

// ─── Exported client ───────────────────────────────────────────────────────────

export const api = {
  entities: {
    Company: createEntity('companies'),
    Client: createEntity('clients'),
    Invoice: {
      ...createEntity('invoices'),
      count: async (query = {}) => {
        const qs = buildQueryString(query);
        return apiCall(`/api/invoices/count?${qs}`);
      },
      aggregate: async (params = {}) => {
        const qs = new URLSearchParams();
        if (params.groupBy) qs.set('groupBy', params.groupBy);
        if (params.sum) qs.set('sum', Array.isArray(params.sum) ? params.sum.join(',') : params.sum);
        if (params.dateBucket) qs.set('dateBucket', params.dateBucket);
        return apiCall(`/api/invoices/aggregate?${qs}`);
      },
      // Advanced: record / list / delete payments
      payments: {
        list: async (invoiceId) => apiCall(`/api/invoices/${invoiceId}/payments`),
        create: async (invoiceId, data) => apiCall(`/api/invoices/${invoiceId}/payments`, { method: 'POST', body: data }),
        delete: async (invoiceId, paymentId) => apiCall(`/api/invoices/${invoiceId}/payments/${paymentId}`, { method: 'DELETE' }),
      },
      // Advanced: send invoice email (async via Celery)
      send: async (invoiceId, data = {}) => apiCall(`/api/invoices/${invoiceId}/send`, { method: 'POST', body: data }),
      // Advanced: duplicate an invoice
      duplicate: async (invoiceId) => apiCall(`/api/invoices/${invoiceId}/duplicate`, { method: 'POST' }),
      // Advanced: backend PDF download URL
      getPdfUrl: (invoiceId) => `${API_BASE}/api/invoices/${invoiceId}/pdf`,
      aging: async () => apiCall('/api/invoices/aging'),
      generatePaymentLink: async (invoiceId, provider) => apiCall(`/api/invoices/${invoiceId}/payment-link`, { method: 'POST', body: { provider } }),
    },
    Expense: {
      ...createEntity('expenses'),
      aggregate: async (params = {}) => {
        const qs = new URLSearchParams();
        if (params.groupBy) qs.set('groupBy', params.groupBy);
        if (params.dateBucket) qs.set('dateBucket', params.dateBucket);
        return apiCall(`/api/expenses/aggregate?${qs}`);
      },
      summary: async () => apiCall('/api/expenses/summary'),
    },
    TimeEntry: {
      ...createEntity('time-entries'),
      running: async () => apiCall('/api/time-entries/running'),
      start: async (data) => apiCall('/api/time-entries/start', { method: 'POST', body: data }),
      stop: async (id) => apiCall(`/api/time-entries/${id}/stop`, { method: 'POST' }),
      unbilled: async () => apiCall('/api/time-entries/unbilled'),
      createInvoice: async (clientId) => apiCall('/api/time-entries/invoice', { method: 'POST', body: { client_id: clientId } }),
    },
    ItemTemplate: createEntity('item-templates'),
    User: {
      list: async () => apiCall('/api/auth/users'),
    },
  },

  integrations: {
    Core: {
      UploadPublicFile: async ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        const res = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      },
      SendEmail: async ({ to, subject, body, html, text, attachments, from_name }) => {
        return apiCall('/api/email', {
          method: 'POST',
          body: { to, subject, body: body || text || html, attachments, from_name },
        });
      },
    },
  },

  auth: {
    me: async () => apiCall('/api/auth/me'),
    logout: (redirectUrl) => {
      clearToken();
      if (redirectUrl) window.location.href = redirectUrl;
    },
    redirectToLogin: (nextUrl) => {
      const returnTo = nextUrl ? `?returnTo=${encodeURIComponent(nextUrl)}` : '';
      window.location.href = `/login${returnTo}`;
    },
    isAuthenticated: async () => {
      if (!getToken()) return false;
      try {
        await apiCall('/api/auth/me');
        return true;
      } catch {
        return false;
      }
    },
    loginViaEmailPassword: async (email, password) => {
      const res = await apiCall('/api/auth/login', { method: 'POST', body: { email, password } });
      setToken(res.access_token);
      return res;
    },
    register: async (data) => {
      // Registration returns a token directly — there is no OTP step.
      const res = await apiCall('/api/auth/register', { method: 'POST', body: data });
      setToken(res.access_token);
      return res;
    },
    resetPasswordRequest: async (email) => {
      await apiCall('/api/auth/reset-request', { method: 'POST', body: { email } });
    },
    resetPassword: async ({ resetToken, newPassword }) => {
      await apiCall('/api/auth/reset', { method: 'POST', body: { reset_token: resetToken, new_password: newPassword } });
    },
  },

  assistant: {
    listConversations: async () => {
      const res = await apiCall('/api/assistant/conversations');
      return { items: res.items || [] };
    },
    createConversation: async (title) => {
      return apiCall('/api/assistant/conversations', { method: 'POST', body: { title } });
    },
    deleteConversation: async (id) => apiCall(`/api/assistant/conversations/${id}`, { method: 'DELETE' }),
    getConversation: async (id) => {
      const [convo, msgs] = await Promise.all([
        apiCall('/api/assistant/conversations').then((r) => (r.items || []).find((c) => c.id === id)),
        apiCall(`/api/assistant/conversations/${id}/messages`),
      ]);
      return { ...convo, id, messages: msgs.items || [] };
    },
    addMessage: async (convoId, { content }) => {
      const res = await apiCall(`/api/assistant/conversations/${convoId}/messages`, {
        method: 'POST',
        body: { content },
      });
      return { messages: res.items || [] };
    },
  },
};

export default api;
