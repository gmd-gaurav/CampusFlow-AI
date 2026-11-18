/* ============================================================
   CampusFlow AI — Core JavaScript Module (app.js)
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  const APPLICATION_CATEGORIES = [
    'Leave Application',
    'Attendance Consideration',
    'Event Permission',
    'Academic Grievance',
    'Fee-Related Request',
    'Examination-Related Request',
    'Timetable Change Request',
    'Classroom Infrastructure Request',
    'Scholarship-Related Request',
    'General Administrative Request',
    'Other'
  ];

  const STATUS_MAP = {
    draft:          { label: 'Draft',          cls: 'badge-draft',          icon: '📝' },
    submitted:      { label: 'Submitted',      cls: 'badge-submitted',      icon: '📤' },
    pending_review: { label: 'Pending Review', cls: 'badge-pending_review', icon: '⏳' },
    approved:       { label: 'Approved',       cls: 'badge-approved',       icon: '✅' },
    rejected:       { label: 'Rejected',       cls: 'badge-rejected',       icon: '❌' }
  };

  const VERIFICATION_MAP = {
    pending_verification: { label: 'Pending Verification', cls: 'badge-pending' },
    verified:             { label: 'Verified',             cls: 'badge-verified' },
    rejected:             { label: 'Rejected',             cls: 'badge-rejected' },
    suspended:            { label: 'Suspended',            cls: 'badge-suspended' }
  };

  const ROLE_LABELS = {
    student: 'Student',
    cr:      'Class Representative',
    faculty: 'Faculty',
    admin:   'Administrator'
  };

  // ── Auth Module ────────────────────────────────────────────
  const Auth = {
    _user: null,

    getToken() {
      return localStorage.getItem('campusflow_token');
    },
    setToken(token) {
      localStorage.setItem('campusflow_token', token);
    },
    clearToken() {
      localStorage.removeItem('campusflow_token');
      Auth._user = null;
    },
    isLoggedIn() {
      return !!Auth.getToken();
    },

    async login(email, password) {
      const res = await API.post('/api/auth/login', { email, password });
      if (res.success) {
        Auth.setToken(res.token);
        Auth._user = res.user;
      }
      return res;
    },

    async logout() {
      try { await API.post('/api/auth/logout'); } catch (_) { /* ignore */ }
      Auth.clearToken();
      window.location.href = '/login.html';
    },

    async register(data) {
      return API.post('/api/auth/register', data);
    },

    async getMe() {
      if (Auth._user) return Auth._user;
      const res = await API.get('/api/auth/me');
      if (res.success) {
        Auth._user = res.user;
        Auth._unread = res.unreadNotifications || 0;
      }
      return res.success ? res.user : null;
    },

    getUser() {
      return Auth._user;
    },

    async requireAuth(allowedRoles) {
      if (!Auth.isLoggedIn()) {
        window.location.href = '/login.html';
        return null;
      }
      const user = await Auth.getMe();
      if (!user) {
        Auth.clearToken();
        window.location.href = '/login.html';
        return null;
      }
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'student' || user.role === 'cr') {
          window.location.href = '/student-dashboard.html';
        } else {
          window.location.href = '/admin-dashboard.html';
        }
        return null;
      }
      return user;
    },

    requireStudentPanel() {
      return Auth.requireAuth(['student', 'cr']);
    },

    requireAdminPanel() {
      return Auth.requireAuth(['faculty', 'admin']);
    }
  };

  // ── API Module ─────────────────────────────────────────────
  const API = {
    async request(method, url, data, isFormData) {
      const opts = {
        method,
        headers: {}
      };
      const token = Auth.getToken();
      if (token) opts.headers['Authorization'] = `Bearer ${token}`;

      if (data) {
        if (isFormData) {
          opts.body = data;
        } else {
          opts.headers['Content-Type'] = 'application/json';
          opts.body = JSON.stringify(data);
        }
      }

      try {
        const response = await fetch(url, opts);
        const json = await response.json();
        if (response.status === 401) {
          Auth.clearToken();
          window.location.href = '/login.html';
          return { success: false, error: 'Session expired.' };
        }
        return json;
      } catch (err) {
        console.error('API request failed:', err);
        return { success: false, error: 'Network error. Please try again.' };
      }
    },

    get(url) { return API.request('GET', url); },
    post(url, data) { return API.request('POST', url, data); },
    patch(url, data) { return API.request('PATCH', url, data); },
    upload(url, formData) { return API.request('POST', url, formData, true); }
  };

  // ── UI Module ──────────────────────────────────────────────
  const UI = {
    showToast(message, type = 'info') {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
      toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${UI.escapeHtml(message)}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'slideOut .3s forwards';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    },

    showModal({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, danger = false }) {
      let overlay = document.getElementById('app-modal-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'app-modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
          <div class="modal">
            <div class="modal-header"><span id="modal-title"></span><button class="modal-close" id="modal-close-btn">&times;</button></div>
            <div class="modal-body" id="modal-body"></div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="modal-cancel-btn"></button>
              <button class="btn" id="modal-confirm-btn"></button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      }
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = body;
      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.textContent = confirmText;
      confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
      document.getElementById('modal-cancel-btn').textContent = cancelText;
      overlay.classList.add('show');

      const close = () => overlay.classList.remove('show');
      document.getElementById('modal-close-btn').onclick = close;
      document.getElementById('modal-cancel-btn').onclick = close;
      confirmBtn.onclick = () => { close(); if (onConfirm) onConfirm(); };
    },

    hideModal() {
      const o = document.getElementById('app-modal-overlay');
      if (o) o.classList.remove('show');
    },

    showLoading(el) {
      if (!el) return;
      el.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
    },

    hideLoading(el) {
      if (!el) return;
      const s = el.querySelector('.loading-overlay');
      if (s) s.remove();
    },

    formatDate(d) {
      if (!d) return '—';
      const dt = new Date(d);
      if (isNaN(dt)) return d;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const day = dt.getDate();
      const month = months[dt.getMonth()];
      const year = dt.getFullYear();
      let hours = dt.getHours();
      const mins = String(dt.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day} ${month} ${year}, ${hours}:${mins} ${ampm}`;
    },

    formatStatus(status) {
      const s = STATUS_MAP[status] || { label: status, cls: 'badge-draft', icon: '📄' };
      return `<span class="badge ${s.cls}">${s.icon} ${s.label}</span>`;
    },

    formatVerification(status) {
      const s = VERIFICATION_MAP[status] || { label: status, cls: 'badge-draft' };
      return `<span class="badge ${s.cls}">${s.label}</span>`;
    },

    escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },

    truncate(str, len = 60) {
      if (!str) return '';
      return str.length > len ? str.substring(0, len) + '…' : str;
    },

    setPageTitle(title) {
      document.title = `${title} — CampusFlow AI`;
    },

    initSidebar() {
      const toggle = document.querySelector('.sidebar-toggle');
      const sidebar = document.querySelector('.sidebar');
      if (toggle && sidebar) {
        toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        // Close on outside click on mobile
        document.addEventListener('click', (e) => {
          if (window.innerWidth <= 768 && sidebar.classList.contains('open') &&
              !sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
          }
        });
      }
    },

    updateNotificationBadge(count) {
      const badges = document.querySelectorAll('.notif-badge');
      badges.forEach(b => {
        b.textContent = count > 0 ? (count > 99 ? '99+' : count) : '';
        b.style.display = count > 0 ? 'flex' : 'none';
      });
    },

    async loadNotifications() {
      const dropdown = document.querySelector('.notif-dropdown');
      if (!dropdown) return;
      const res = await API.get('/api/notifications');
      if (!res.success) return;

      UI.updateNotificationBadge(res.unreadCount || 0);

      const list = dropdown.querySelector('.notif-list');
      if (!list) return;

      if (!res.notifications || res.notifications.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-icon">🔔</div><div class="empty-desc">No notifications</div></div>';
        return;
      }

      list.innerHTML = res.notifications.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
          <div class="notif-title">${UI.escapeHtml(n.title)}</div>
          <div class="notif-msg">${UI.escapeHtml(n.message)}</div>
          <div class="notif-time">${UI.formatDate(n.created_at)}</div>
        </div>
      `).join('');

      list.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', async () => {
          const id = item.dataset.id;
          const link = item.dataset.link;
          await API.post(`/api/notifications/${id}/read`);
          item.classList.remove('unread');
          if (link) window.location.href = link;
        });
      });
    },

    buildStudentSidebar(user) {
      return `
        <div class="sidebar" id="sidebar">
          <div class="sidebar-logo"><span>🎓</span> CampusFlow AI</div>
          <div class="sidebar-user">
            <div class="user-name">${UI.escapeHtml(user.full_name)}</div>
            <div class="user-role">${ROLE_LABELS[user.role] || user.role}${user.role === 'cr' ? ' 🏷️' : ''} • ${UI.escapeHtml(user.department_name || '')}</div>
          </div>
          <nav class="sidebar-nav">
            <a href="/student-dashboard.html" data-page="student-dashboard"><span class="nav-icon">📊</span> Dashboard</a>
            <a href="/create-application.html" data-page="create-application"><span class="nav-icon">✏️</span> Create Application</a>
            <a href="/my-applications.html" data-page="my-applications"><span class="nav-icon">📋</span> My Applications</a>
            <a href="/profile.html" data-page="profile"><span class="nav-icon">👤</span> Profile</a>
            <div class="sidebar-label">Account</div>
            <a href="#" id="logout-link"><span class="nav-icon">🚪</span> Logout</a>
          </nav>
        </div>`;
    },

    buildAdminSidebar(user) {
      const isAdmin = user.role === 'admin';
      return `
        <div class="sidebar" id="sidebar">
          <div class="sidebar-logo"><span>🎓</span> CampusFlow AI</div>
          <div class="sidebar-user">
            <div class="user-name">${UI.escapeHtml(user.full_name)}</div>
            <div class="user-role">${UI.escapeHtml(user.designation || ROLE_LABELS[user.role])} • ${UI.escapeHtml(user.department_name || 'Admin')}</div>
          </div>
          <nav class="sidebar-nav">
            <div class="sidebar-label">Administration</div>
            <a href="/admin-dashboard.html" data-page="admin-dashboard"><span class="nav-icon">📊</span> Dashboard</a>
            <a href="/incoming-applications.html" data-page="incoming-applications"><span class="nav-icon">📥</span> Incoming Applications</a>
            ${isAdmin ? '<a href="/verify-students.html" data-page="verify-students"><span class="nav-icon">👥</span> Verify Students</a>' : ''}
            <a href="/profile.html" data-page="profile"><span class="nav-icon">👤</span> My Profile</a>
            <div class="sidebar-label">Account</div>
            <a href="#" id="logout-link"><span class="nav-icon">🚪</span> Logout</a>
          </nav>
        </div>`;
    },

    buildTopbar(title) {
      return `
        <div class="topbar">
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="sidebar-toggle" aria-label="Toggle menu">☰</button>
            <div class="topbar-title">${UI.escapeHtml(title)}</div>
          </div>
          <div class="topbar-actions">
            <div style="position:relative;">
              <button class="notif-btn" id="notif-toggle" aria-label="Notifications">🔔<span class="notif-badge" style="display:none;"></span></button>
              <div class="notif-dropdown" id="notif-dropdown">
                <div class="notif-header"><span>Notifications</span><button class="btn btn-sm btn-outline" id="mark-all-read">Mark all read</button></div>
                <div class="notif-list"></div>
              </div>
            </div>
          </div>
        </div>`;
    },

    setupPage(user, pageId) {
      // Highlight active sidebar link
      document.querySelectorAll('.sidebar-nav a').forEach(a => {
        if (a.dataset.page === pageId) a.classList.add('active');
      });

      // Logout
      const logoutLink = document.getElementById('logout-link');
      if (logoutLink) logoutLink.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });

      // Sidebar toggle
      UI.initSidebar();

      // Notifications
      const notifToggle = document.getElementById('notif-toggle');
      const notifDropdown = document.getElementById('notif-dropdown');
      if (notifToggle && notifDropdown) {
        notifToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          notifDropdown.classList.toggle('show');
          if (notifDropdown.classList.contains('show')) UI.loadNotifications();
        });
        document.addEventListener('click', (e) => {
          if (!notifDropdown.contains(e.target)) notifDropdown.classList.remove('show');
        });
      }

      const markAllBtn = document.getElementById('mark-all-read');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
          await API.post('/api/notifications/read-all');
          UI.updateNotificationBadge(0);
          UI.loadNotifications();
        });
      }

      // Initial notification count
      if (Auth._unread !== undefined) UI.updateNotificationBadge(Auth._unread);

      // Poll notifications every 60s
      setInterval(async () => {
        const res = await API.get('/api/notifications');
        if (res.success) UI.updateNotificationBadge(res.unreadCount || 0);
      }, 60000);
    }
  };

  // ── Expose Globally ────────────────────────────────────────
  window.Auth = Auth;
  window.API = API;
  window.UI = UI;
  window.APP_CONSTANTS = {
    APPLICATION_CATEGORIES,
    STATUS_MAP,
    VERIFICATION_MAP,
    ROLE_LABELS
  };
})();
