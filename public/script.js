document.addEventListener('DOMContentLoaded', function() {
  const currentYear = new Date().getFullYear();
  document.getElementById('currentYear').textContent = currentYear;
  const calendarEl = document.getElementById('calendar');
  const addEventModal = document.getElementById('eventModal');
  const eventForm = document.getElementById('eventForm');
  let currentEvent = null;
  const todaySummaryList = document.getElementById('todaySummaryList');
  const todaySummaryEmpty = document.getElementById('todaySummaryEmpty');
  const todaySummaryTotal = document.getElementById('todaySummaryTotal');
  const weekSummaryGrid = document.getElementById('weekSummaryGrid');
  const loginModal = document.getElementById('loginModal');
  let hasAuthError = false;
  let tokenExpiryTimer = null;
  let refreshInFlight = null;
  let lastRefreshAttemptAt = 0;
  let lastRefreshSucceeded = true;
  const REFRESH_LEEWAY_MS = 5000;
  const MIN_REFRESH_INTERVAL_MS = 2000;
  const TASK_STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'complete', label: 'Complete' },
    { value: 'rejected', label: 'Rejected' },
  ];
  const TASK_TYPES = [
    { value: 'feature', label: 'Feature' },
    { value: 'bug', label: 'Bug' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'announcement', label: 'Announcement' },
  ];
  const globalLoadingOverlay = document.getElementById('globalLoading');
  let activeLoadingRequests = 0;
  const COLLAPSE_STORAGE_KEY = 'calendar_panel_states';
  let collapseStateCache = null;

  function updateLoadingOverlay() {
    if (!globalLoadingOverlay) return;
    if (activeLoadingRequests > 0) {
      globalLoadingOverlay.classList.add('visible');
      globalLoadingOverlay.setAttribute('aria-hidden', 'false');
    } else {
      globalLoadingOverlay.classList.remove('visible');
      globalLoadingOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  function startLoading() {
    activeLoadingRequests += 1;
    updateLoadingOverlay();
  }

  function stopLoading() {
    activeLoadingRequests = Math.max(0, activeLoadingRequests - 1);
    updateLoadingOverlay();
  }

  function readCollapseStates() {
    if (collapseStateCache) {
      return collapseStateCache;
    }
    try {
      const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          collapseStateCache = parsed;
          return collapseStateCache;
        }
      }
    } catch (error) {
      console.warn('Failed to read panel states from storage', error);
    }
    collapseStateCache = {};
    return collapseStateCache;
  }

  function persistCollapseStates() {
    if (!collapseStateCache) return;
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapseStateCache));
    } catch (error) {
      console.warn('Failed to persist panel states', error);
    }
  }

  function setCollapseState(panelId, isCollapsed) {
    const states = readCollapseStates();
    states[panelId] = Boolean(isCollapsed);
    persistCollapseStates();
  }

  function collapseContent(content, panel, trigger) {
    if (!content || content.dataset.collapsed === 'true') return;
    const startHeight = content.scrollHeight;
    content.dataset.collapsed = 'true';
    content.setAttribute('aria-hidden', 'true');
    content.style.maxHeight = `${startHeight}px`;
    trigger.setAttribute('aria-expanded', 'false');
    if (panel) panel.classList.add('is-collapsed');
    requestAnimationFrame(() => {
      content.classList.add('is-collapsed');
      content.style.maxHeight = '0px';
    });
  }

  function expandContent(content, panel, trigger) {
    if (!content || content.dataset.collapsed !== 'true') return;
    content.dataset.collapsed = 'false';
    content.classList.remove('is-collapsed');
    content.setAttribute('aria-hidden', 'false');
    const targetHeight = content.scrollHeight;
    content.style.maxHeight = `${targetHeight}px`;
    trigger.setAttribute('aria-expanded', 'true');
    if (panel) panel.classList.remove('is-collapsed');
    let fallbackTimeout;
    const handleTransitionEnd = (event) => {
      if (event && event.target !== content) return;
      if (content.dataset.collapsed === 'false') {
        content.style.maxHeight = '';
      }
      content.removeEventListener('transitionend', handleTransitionEnd);
      clearTimeout(fallbackTimeout);
    };
    fallbackTimeout = setTimeout(() => handleTransitionEnd(), 400);
    content.addEventListener('transitionend', handleTransitionEnd);
  }

  function applyCollapseState(content, panel, trigger, shouldCollapse, disableAnimation = false) {
    if (!content || !trigger) return;
    let previousTransition;
    if (disableAnimation) {
      previousTransition = content.style.transition;
      content.style.transition = 'none';
    }
    if (shouldCollapse) {
      content.dataset.collapsed = 'true';
      content.classList.add('is-collapsed');
      content.setAttribute('aria-hidden', 'true');
      content.style.maxHeight = '0px';
      trigger.setAttribute('aria-expanded', 'false');
      if (panel) panel.classList.add('is-collapsed');
    } else {
      content.dataset.collapsed = 'false';
      content.classList.remove('is-collapsed');
      content.setAttribute('aria-hidden', 'false');
      content.style.maxHeight = '';
      trigger.setAttribute('aria-expanded', 'true');
      if (panel) panel.classList.remove('is-collapsed');
    }
    if (disableAnimation) {
      requestAnimationFrame(() => {
        content.style.transition = previousTransition || '';
      });
    }
  }

  function scrollPanelIntoView(panel) {
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.pageYOffset - 20;
    window.scrollTo({
      top: top < 0 ? 0 : top,
      behavior: 'smooth',
    });
  }

  function initCollapsiblePanels() {
    const triggers = document.querySelectorAll('[data-collapsible-trigger]');
    const storedStates = readCollapseStates();
    triggers.forEach(trigger => {
      const contentId = trigger.dataset.collapsibleTrigger;
      if (!contentId) return;
      const content = document.getElementById(contentId);
      if (!content) return;
      const panel = trigger.closest('.panel');
      const defaultCollapsed = contentId !== 'calendarPanelContent';
      const shouldCollapse = Object.prototype.hasOwnProperty.call(storedStates, contentId)
        ? Boolean(storedStates[contentId])
        : defaultCollapsed;
      applyCollapseState(content, panel, trigger, shouldCollapse, true);
      trigger.addEventListener('click', () => {
        const isCollapsed = content.dataset.collapsed === 'true';
        if (isCollapsed) {
          expandContent(content, panel, trigger);
          setCollapseState(contentId, false);
          scrollPanelIntoView(panel);
        } else {
          collapseContent(content, panel, trigger);
          setCollapseState(contentId, true);
        }
      });
    });
  }

  function decodeJwtPayload(token) {
    try {
      const segments = token.split('.');
      if (segments.length < 2) return null;
      const base64Url = segments[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const jsonPayload = atob(padded);
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token payload', error);
      return null;
    }
  }

  function clearTokenExpiryTimer() {
    if (tokenExpiryTimer) {
      clearTimeout(tokenExpiryTimer);
      tokenExpiryTimer = null;
    }
  }

  async function revokeRefreshToken(refreshToken) {
    if (!refreshToken) return;
    startLoading();
    try {
      await fetch('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.error('Failed to revoke refresh token', error);
    } finally {
      stopLoading();
    }
  }

  function clearStoredTokens() {
    clearTokenExpiryTimer();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  function scheduleTokenExpiryCheck(token) {
    clearTokenExpiryTimer();
    if (!token) return;
    const decodedPayload = decodeJwtPayload(token);
    if (!decodedPayload || !decodedPayload.exp) return;
    const expiresAtMs = Number(decodedPayload.exp) * 1000;
    const now = Date.now();
    const millisUntilExpiry = expiresAtMs - now;
    if (!(millisUntilExpiry > 0)) {
      promptReLogin();
      return;
    }
    let refreshDelay;
    if (millisUntilExpiry <= REFRESH_LEEWAY_MS + 1000) {
      refreshDelay = Math.max(millisUntilExpiry - 1000, 1000);
    } else {
      refreshDelay = millisUntilExpiry - REFRESH_LEEWAY_MS;
    }
    if (!(refreshDelay > 0)) {
      refreshDelay = 1000;
    }
    tokenExpiryTimer = setTimeout(async () => {
      const didRefresh = await attemptTokenRefresh();
      if (!didRefresh) {
        promptReLogin();
      }
    }, refreshDelay);
  }

  function storeTokens({ token, refreshToken }) {
    if (!token || !refreshToken) {
      console.error('Missing token payload; clearing session');
      clearStoredTokens();
      throw new Error('Missing token payload');
    }
    hasAuthError = false;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    scheduleTokenExpiryCheck(token);
  }

  async function attemptTokenRefresh() {
    if (refreshInFlight) {
      return refreshInFlight;
    }
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return false;
    }
    const now = Date.now();
    if (now - lastRefreshAttemptAt < MIN_REFRESH_INTERVAL_MS) {
      return lastRefreshSucceeded;
    }
    lastRefreshAttemptAt = now;
    const refreshPromise = (async () => {
      const tokenForRevocation = refreshToken;
      startLoading();
      try {
        const response = await fetch('/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokenForRevocation }),
        });
        if (!response.ok) {
          clearStoredTokens();
          await revokeRefreshToken(tokenForRevocation);
          lastRefreshSucceeded = false;
          return false;
        }
        const payload = await response.json();
        if (!payload.token || !payload.refreshToken) {
          clearStoredTokens();
          await revokeRefreshToken(tokenForRevocation);
          lastRefreshSucceeded = false;
          return false;
        }
        storeTokens(payload);
        lastRefreshSucceeded = true;
        return true;
      } catch (error) {
        console.error('Failed to refresh session', error);
        clearStoredTokens();
        await revokeRefreshToken(tokenForRevocation);
        lastRefreshSucceeded = false;
        return false;
      } finally {
        stopLoading();
        refreshInFlight = null;
        lastRefreshAttemptAt = Date.now();
      }
    })();
    refreshInFlight = refreshPromise;
    return refreshPromise;
  }

  function promptReLogin() {
    if (hasAuthError) return;
    hasAuthError = true;
    const storedRefreshToken = localStorage.getItem('refreshToken');
    clearStoredTokens();
    if (storedRefreshToken) {
      revokeRefreshToken(storedRefreshToken);
    }
    const addEventButtonEl = document.getElementById('addEventButton');
    if (addEventButtonEl) {
      addEventButtonEl.style.display = 'none';
    }
    if (loginModal) {
      loginModal.style.display = 'flex';
    }
    alert('Please log in again to continue.');
  }

  function formatStatusLabel(status) {
    const match = TASK_STATUSES.find(s => s.value === status);
    if (match) return match.label;
    return status ? status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ') : 'Pending';
  }

  function formatTypeLabel(type) {
    const match = TASK_TYPES.find(t => t.value === type);
    if (match) return match.label;
    return type ? type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ') : 'Feature';
  }

  function toYMD(d) {
    // d can be Date or string; always return 'YYYY-MM-DD' in local
    return moment(d).format('YYYY-MM-DD');
  }
  
  function addOneDay(ymd) {
    return ymd ? moment(ymd, 'YYYY-MM-DD').add(1, 'day').format('YYYY-MM-DD') : null;
  }
  
  function subOneDay(ymd) {
    return ymd ? moment(ymd, 'YYYY-MM-DD').subtract(1, 'day').format('YYYY-MM-DD') : null;
  }
  const typeColors = {
    feature: '#4F46E5',
    bug: '#DC2626',
    scheduled: '#059669',
    announcement: '#7C3AED',
  };

  const statusColors = {
    'pending': '#F59E0B',      // amber
    'in-progress': '#3B82F6',  // blue
    'complete': '#22C55E',     // green
    'rejected': '#EF4444',     // red
  };
  const getStatusColor = (status = 'pending') => statusColors[status] || '#94a3b8';

  function setStatusSelection(status = 'pending') {
    let matched = false;
    document.querySelectorAll('.status-option').forEach(option => {
      const isMatch = option.dataset.status === status;
      option.classList.toggle('selected', isMatch);
      if (isMatch) matched = true;
    });
    if (!matched) {
      document.querySelectorAll('.status-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.status === 'pending');
      });
    }
  }

  const getTypeColor = (type = 'feature') => typeColors[type] || typeColors.feature;

  function setTypeSelection(type = 'feature') {
    let matched = false;
    document.querySelectorAll('.type-option').forEach(option => {
      const isMatch = option.dataset.type === type;
      option.classList.toggle('selected', isMatch);
      if (isMatch) matched = true;
    });
    if (!matched) {
      document.querySelectorAll('.type-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.type === 'feature');
      });
    }
    applyTypeStyles();
  }

  function applyTypeStyles() {
    document.querySelectorAll('.type-option').forEach(option => {
      const type = option.dataset.type || 'feature';
      const color = getTypeColor(type);
      const chip = option.querySelector('.type-chip');
      if (chip) {
        chip.style.color = color;
        chip.style.borderColor = color;
        chip.style.background = '#fff';
      }
      option.style.borderColor = color;
      option.style.color = color;
      option.style.background = option.classList.contains('selected') ? '' : '#fff';
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const TOOLTIP_VIEWPORT_PADDING = 12;

  function adjustTooltipWithinViewport(tooltip) {
    if (!tooltip) return;
    tooltip.style.setProperty('--tooltip-shift', '0px');
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    let shift = 0;
    if (rect.left < TOOLTIP_VIEWPORT_PADDING) {
      shift = TOOLTIP_VIEWPORT_PADDING - rect.left;
    } else if (rect.right > viewportWidth - TOOLTIP_VIEWPORT_PADDING) {
      shift = (viewportWidth - TOOLTIP_VIEWPORT_PADDING) - rect.right;
    }
    tooltip.style.setProperty('--tooltip-shift', `${shift}px`);
  }

  function attachTooltipHandlers(triggerEl, tooltipSelector) {
    if (!triggerEl || triggerEl.dataset.tooltipBound === 'true') {
      return;
    }
    const tooltip = typeof tooltipSelector === 'string'
      ? triggerEl.querySelector(tooltipSelector)
      : tooltipSelector;
    if (!tooltip) {
      return;
    }

    const adjust = () => adjustTooltipWithinViewport(tooltip);
    const reset = () => tooltip.style.setProperty('--tooltip-shift', '0px');

    triggerEl.addEventListener('mouseenter', adjust);
    triggerEl.addEventListener('focusin', adjust);
    triggerEl.addEventListener('touchstart', adjust, { passive: true });
    triggerEl.addEventListener('mouseleave', reset);
    triggerEl.addEventListener('focusout', reset);
    triggerEl.addEventListener('touchend', reset);
    triggerEl.addEventListener('touchcancel', reset);

    triggerEl.__tooltipElement = tooltip;
    triggerEl.dataset.tooltipBound = 'true';
  }

  function updateTodaySummary(rawEvents = []) {
    if (!todaySummaryList || !todaySummaryEmpty || !todaySummaryTotal) return;
    const total = rawEvents.length;
    todaySummaryTotal.textContent = total === 1 ? '1 task' : `${total} tasks`;
    todaySummaryList.innerHTML = '';
    if (total === 0) {
      todaySummaryEmpty.hidden = false;
      return;
    }
    todaySummaryEmpty.hidden = true;
    const sortedEvents = rawEvents.slice().sort((a, b) => {
      const aStart = moment(a.start, 'YYYY-MM-DD');
      const bStart = moment(b.start, 'YYYY-MM-DD');
      if (!aStart.isSame(bStart)) return aStart.isBefore(bStart) ? -1 : 1;
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
    sortedEvents.forEach(evt => {
      const statusValue = (evt.status || 'pending');
      const statusColor = getStatusColor(statusValue);
      const typeValue = (evt.task_type || evt.taskType || 'feature');
      const typeColor = getTypeColor(typeValue);
      const titleText = evt.title || 'Untitled Task';
      const safeTitle = escapeHtml(titleText);
      const rawDescription = evt.description && String(evt.description).trim().length
        ? evt.description
        : 'No description provided.';
      const safeDescription = escapeHtml(rawDescription).replace(/\n/g, '<br>');
      const li = document.createElement('li');
      li.className = 'summary-item';
      li.dataset.type = typeValue;
      const statusOptions = TASK_STATUSES.map(({ value, label }) => `
        <option value="${value}" ${value === statusValue ? 'selected' : ''}>${label}</option>
      `).join('');
      li.innerHTML = `
        <span class="summary-dot" style="background:${statusColor}; border-color:${statusColor};"></span>
        <div class="summary-meta">
          <span class="summary-label" tabindex="0">${safeTitle}</span>
          <span class="summary-tooltip" role="tooltip">
            <span class="summary-tooltip-title">${safeTitle}</span>
            <span class="summary-tooltip-desc">${safeDescription}</span>
          </span>
          <div class="summary-subrow">
            <span class="summary-type type-chip" style="color:${typeColor}; border-color:${typeColor};">${formatTypeLabel(typeValue)}</span>
            <select class="summary-status" data-id="${evt.id}" data-status="${statusValue}">
              ${statusOptions}
            </select>
          </div>
        </div>
        <span class="summary-count">${moment(evt.start).format('MMM D')}</span>
      `;
      todaySummaryList.appendChild(li);
      const labelEl = li.querySelector('.summary-label');
      const tooltipEl = li.querySelector('.summary-tooltip');
      if (labelEl && tooltipEl) {
        attachTooltipHandlers(labelEl, tooltipEl);
      }
    });
  }

  function updateWeekSummary(rawEvents = []) {
    if (!weekSummaryGrid) return;
    const weekStart = moment().startOf('isoWeek');
    const weekDays = Array.from({ length: 7 }, (_, idx) => {
      const date = weekStart.clone().add(idx, 'day');
      return {
        date,
        label: date.format('dddd'),
        concise: date.format('MMM D'),
      };
    });
    weekSummaryGrid.innerHTML = '';
    weekDays.forEach(day => {
      const matches = rawEvents.filter(evt => {
        const start = moment(evt.start, 'YYYY-MM-DD');
        const end = moment(evt.end || evt.start, 'YYYY-MM-DD');
        return start.isSameOrBefore(day.date, 'day') && end.isSameOrAfter(day.date, 'day');
      }).sort((a, b) => {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        return aTitle.localeCompare(bTitle);
      });
      const items = matches.slice(0, 3).map(evt => {
        const typeValue = evt.task_type || evt.taskType || 'feature';
        const typeColor = getTypeColor(typeValue);
        const statusValue = evt.status || 'pending';
        const statusColor = getStatusColor(statusValue);
        const titleText = evt.title || 'Untitled Task';
        const safeTitle = escapeHtml(titleText);
        const rawDescription = evt.description && String(evt.description).trim().length
          ? evt.description
          : '-';
        const safeDescription = escapeHtml(rawDescription).replace(/\n/g, '<br>');
        return `
          <li>
            <span class="week-bullet" style="background:${statusColor}; border-color:${statusColor};"></span>
            <span class="week-task" title="${safeTitle}" aria-label="${safeTitle}">
              <span class="week-task-label">${safeTitle}</span>
              <span class="week-task-tooltip" role="tooltip">
                <span class="week-task-tooltip-title">${safeTitle}</span>
                <span class="week-task-tooltip-desc">${safeDescription}</span>
              </span>
            </span>
            <span class="week-type type-chip" style="color:${typeColor}; border-color:${typeColor};">${formatTypeLabel(typeValue)}</span>
          </li>
        `;
      }).join('');
      const innerList = items || '<li class="week-empty-text">No tasks</li>';
      const card = document.createElement('div');
      card.className = 'week-card';
      card.innerHTML = `
        <div class="week-card-head">
          <div>
            <span class="week-day">${day.label}</span>
            <span class="week-date">${day.concise}</span>
          </div>
          <span class="week-count">${matches.length} ${matches.length === 1 ? 'task' : 'tasks'}</span>
        </div>
        <ul class="week-list">
          ${innerList}
        </ul>
      `;
      weekSummaryGrid.appendChild(card);
      card.querySelectorAll('.week-task').forEach(taskEl => {
        attachTooltipHandlers(taskEl, '.week-task-tooltip');
      });
    });
  }

  const statusFilterContainer = document.querySelector('[data-filter="status"]');
  const typeFilterContainer = document.querySelector('[data-filter="type"]');
  const selectAllStatusCheckbox = document.getElementById('select-all-status');
  const selectAllTypeCheckbox = document.getElementById('select-all-type');

  const savedStatuses = JSON.parse(localStorage.getItem('calendar_status_filters'));
  const savedTypes = JSON.parse(localStorage.getItem('calendar_type_filters'));

  function setChipState(checkbox, isChecked) {
    checkbox.checked = isChecked;
    const chip = checkbox.nextElementSibling;
    if (!chip) return;
    chip.classList.toggle('selected', !isChecked);
    const textEl = chip.querySelector('.filter-chip-text');
    if (textEl) {
      const baseLabel = textEl.dataset.label || textEl.textContent.replace(' ✓', '');
      textEl.dataset.label = baseLabel;
      textEl.textContent = isChecked ? `${baseLabel} ✓` : baseLabel;
    }
  }

  function renderFilterChips(container, items, inputClass, savedValues, prefixClass) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach(({ value, label }) => {
      const isChecked = savedValues ? savedValues.includes(value) : true;
      const option = document.createElement('label');
      option.className = 'filter-chip';
      option.innerHTML = `
        <input type="checkbox" class="${inputClass}" value="${value}" ${isChecked ? 'checked' : ''}>
        <span class="filter-chip-pill ${prefixClass}-pill ${prefixClass}-pill--${value} ${!isChecked ? 'selected' : ''}">
          <span class="filter-chip-text" data-label="${label}">${label}${isChecked ? ' ✓' : ''}</span>
        </span>
      `;
      container.appendChild(option);
    });
  }

  renderFilterChips(statusFilterContainer, TASK_STATUSES, 'status-filter', savedStatuses, 'status');
  renderFilterChips(typeFilterContainer, TASK_TYPES, 'type-filter', savedTypes, 'type');

  document.querySelectorAll('.status-filter').forEach(filter => setChipState(filter, filter.checked));
  document.querySelectorAll('.type-filter').forEach(filter => setChipState(filter, filter.checked));

  const getSelectedStatuses = () => Array.from(document.querySelectorAll('.status-filter:checked')).map(cb => cb.value);
  const getSelectedTypes = () => Array.from(document.querySelectorAll('.type-filter:checked')).map(cb => cb.value);

  function updateSelectAllStatus() {
    if (!selectAllStatusCheckbox) return;
    const filters = document.querySelectorAll('.status-filter');
    selectAllStatusCheckbox.checked = filters.length > 0 && Array.from(filters).every(filter => filter.checked);
  }

  function updateSelectAllTypes() {
    if (!selectAllTypeCheckbox) return;
    const filters = document.querySelectorAll('.type-filter');
    selectAllTypeCheckbox.checked = filters.length > 0 && Array.from(filters).every(filter => filter.checked);
  }

  updateSelectAllStatus();
  updateSelectAllTypes();

  if (selectAllStatusCheckbox) {
    selectAllStatusCheckbox.addEventListener('change', (e) => {
      document.querySelectorAll('.status-filter').forEach(filter => {
        setChipState(filter, e.target.checked);
      });
      const selectedStatuses = getSelectedStatuses();
      localStorage.setItem('calendar_status_filters', JSON.stringify(selectedStatuses));
      calendar.refetchEvents();
    });
  }

  if (selectAllTypeCheckbox) {
    selectAllTypeCheckbox.addEventListener('change', (e) => {
      document.querySelectorAll('.type-filter').forEach(filter => {
        setChipState(filter, e.target.checked);
      });
      const selectedTypes = getSelectedTypes();
      localStorage.setItem('calendar_type_filters', JSON.stringify(selectedTypes));
      calendar.refetchEvents();
    });
  }

  [statusFilterContainer, typeFilterContainer].forEach(container => {
    if (!container) return;
    container.addEventListener('change', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
      setChipState(target, target.checked);
      if (target.classList.contains('status-filter')) {
        const selectedStatuses = getSelectedStatuses();
        localStorage.setItem('calendar_status_filters', JSON.stringify(selectedStatuses));
        updateSelectAllStatus();
      } else if (target.classList.contains('type-filter')) {
        const selectedTypes = getSelectedTypes();
        localStorage.setItem('calendar_type_filters', JSON.stringify(selectedTypes));
        updateSelectAllTypes();
      }
      calendar.refetchEvents();
    });
  });

  document.getElementById('eventStart').addEventListener('change', (e) => {
    const newEndDate = getOneWeekLater(e.target.value);
    document.getElementById('eventEnd').value = newEndDate;
  });

  function getOneWeekLater(dateStr) {
    return moment(dateStr).add(1, 'week').format('YYYY-MM-DD');
  }

  updateTodaySummary([]);
  updateWeekSummary([]);
  updateSelectAllStatus();
  updateSelectAllTypes();

  function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    if (modal === addEventModal) {
      eventForm.reset();
      setStatusSelection('pending');
      setTypeSelection('feature');
      currentEvent = null;
    }
  }

  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', () => {
      closeModal(button.closest('.modal'));
    });
  });

  if (todaySummaryList) {
    todaySummaryList.addEventListener('change', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (!target.classList.contains('summary-status')) return;
      const eventId = target.dataset.id;
      const newStatus = target.value;
      if (!eventId || !newStatus) return;
      const previousStatus = target.dataset.status || target.getAttribute('data-status') || '';
      target.dataset.status = newStatus;
      target.setAttribute('data-status', newStatus);
      target.disabled = true;
      let didUpdate = false;
      try {
        await fetchWithToken(`/events/${eventId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        didUpdate = true;
      } catch (err) {
        console.error('Failed to update status', err);
        target.value = previousStatus || target.value;
      } finally {
        target.disabled = false;
        if (didUpdate) {
          calendar.refetchEvents();
        } else {
          if (previousStatus) {
            target.dataset.status = previousStatus;
            target.setAttribute('data-status', previousStatus);
          }
        }
      }
    });
  }

  window.addEventListener('resize', () => {
    document.querySelectorAll('[data-tooltip-bound="true"]').forEach(trigger => {
      if (trigger.__tooltipElement) {
        adjustTooltipWithinViewport(trigger.__tooltipElement);
      }
    });
  });

  async function fetchWithToken(url, options = {}, allowRetry = true) {
    startLoading();
    let token = localStorage.getItem('token');
    try {
      if (!token) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          token = localStorage.getItem('token');
        }
      }
      if (!token) {
        promptReLogin();
        throw new Error('Authentication required');
      }

      const baseHeaders = options.headers ? { ...options.headers } : {};
      const headers = {
        ...baseHeaders,
        'Authorization': `Bearer ${token}`,
      };

      const response = await fetch(url, { ...options, headers });
      if ((response.status === 401 || response.status === 403) && allowRetry) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          const retriedResponse = await fetchWithToken(url, options, false);
          return retriedResponse;
        }
      }
      if (response.status === 401 || response.status === 403) {
        promptReLogin();
        const unauthorizedError = new Error(`Unauthorized: ${response.status}`);
        unauthorizedError.response = response;
        throw unauthorizedError;
      }

      return response;
    } finally {
      stopLoading();
    }
  }

  let calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    contentHeight: 'auto',
    expandRows: true,
    editable: true,
    selectable: true,
    droppable: true,
    eventResizableFromStart: true,
    displayEventTime: false,
    headerToolbar: {
      left: 'title',

      right: 'prev,next'
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      const selectedStatuses = getSelectedStatuses();
      const selectedTypes = getSelectedTypes();
      if (selectedStatuses.length === 0 || selectedTypes.length === 0) {
        updateTodaySummary([]);
        updateWeekSummary([]);
        successCallback([]);
        return;
      }
      const queryParts = [
        ...selectedStatuses.map(s => `statuses[]=${encodeURIComponent(s)}`),
        ...selectedTypes.map(t => `types[]=${encodeURIComponent(t)}`),
      ];
      const query = queryParts.join('&');
      fetchWithToken(`/events?${query}`)
        .then(response => response.json())
        .then(data => {
          console.log('Data from server:', data);
          const today = moment().format('YYYY-MM-DD');
          const todayEvents = data.filter(evt => {
            const start = moment(evt.start, 'YYYY-MM-DD');
            const end = moment(evt.end || evt.start, 'YYYY-MM-DD');
            return start.isSameOrBefore(today) && end.isSameOrAfter(today);
          });
          updateTodaySummary(todayEvents);
          updateWeekSummary(data);
          const events = data.map(evt => ({
            id: evt.id,
            title: evt.title,
            start: evt.start,               // 'YYYY-MM-DD'
            end: addOneDay(evt.end),        // make it exclusive for FC
            allDay: true,
            extendedProps: {
              description: evt.description,
              status: evt.status,
              taskType: evt.task_type || evt.taskType || 'feature',
            }
          }));
          console.log('Events passed to successCallback:', events);
          successCallback(events);
        })
        .catch(error => {
          updateTodaySummary([]);
          updateWeekSummary([]);
          failureCallback(error);
        });
    },
    dateClick: function(info) {
      currentEvent = null;
      eventForm.reset();
      document.getElementById('modalTitle').innerText = 'Add Event';
      document.getElementById('eventStart').value = info.dateStr;
      document.getElementById('eventEnd').value = getOneWeekLater(info.dateStr);
      setStatusSelection('pending');
      setTypeSelection('feature');
      addEventModal.style.display = 'flex';
    },

    eventDidMount: function(info) {
      const typeColor = getTypeColor(info.event.extendedProps.taskType);
      const statusColor = getStatusColor(info.event.extendedProps.status);
      info.el.style.background = '#ffffff';
      info.el.style.border = `3px solid ${statusColor}`;
      info.el.style.boxShadow = `0 0 0 2px ${statusColor}33`;
      info.el.style.color = typeColor;
      info.el.style.fontWeight = '600';
      info.el.querySelectorAll('.fc-event-title, .fc-event-time, .fc-event-main, .fc-event-title-container, .fc-event-main-frame').forEach(node => {
        node.style.color = typeColor;
      });
      info.el.classList.add('calendar-event');
      info.el.style.overflow = 'visible';
      if (!info.el.getAttribute('tabindex')) {
        info.el.setAttribute('tabindex', '0');
      }

      const harnessEl = info.el.parentElement;
      if (harnessEl && harnessEl.classList && harnessEl.classList.contains('fc-daygrid-event-harness')) {
        harnessEl.style.overflow = 'visible';
      }

      const existingTooltip = info.el.querySelector('.calendar-event-tooltip');
      if (existingTooltip) {
        existingTooltip.remove();
      }

      const titleText = info.event.title || 'Untitled Task';
      const safeTitle = escapeHtml(titleText);
      const rawDescription = info.event.extendedProps.description && String(info.event.extendedProps.description).trim().length
        ? info.event.extendedProps.description
        : '-';
      const safeDescription = escapeHtml(rawDescription).replace(/\n/g, '<br>');
      const statusLabel = formatStatusLabel(info.event.extendedProps.status);
      const typeLabel = formatTypeLabel(info.event.extendedProps.taskType);

      const tooltip = document.createElement('div');
      tooltip.className = 'calendar-event-tooltip';
      tooltip.innerHTML = `
        <span class="calendar-event-tooltip-title">${safeTitle}</span>
        <span class="calendar-event-tooltip-meta">
          <span class="calendar-event-tooltip-chip" style="border-color:${typeColor}; color:${typeColor};">${typeLabel}</span>
          <span class="calendar-event-tooltip-chip calendar-event-tooltip-chip--status" style="border-color:${statusColor}; color:${statusColor};">${statusLabel}</span>
        </span>
        <span class="calendar-event-tooltip-desc">${safeDescription}</span>
      `;
      info.el.appendChild(tooltip);
      attachTooltipHandlers(info.el, '.calendar-event-tooltip');
    },

    eventClick: function(info) {
      currentEvent = info.event;
      document.getElementById('modalTitle').innerText = 'Edit Event';
      document.getElementById('eventTitle').value = currentEvent.title;
      document.getElementById('eventDescription').value = currentEvent.extendedProps.description || '';
      document.getElementById('eventStart').value = toYMD(currentEvent.start);
      const inclusiveEnd = currentEvent.end ? subOneDay(toYMD(currentEvent.end)) : toYMD(currentEvent.start);
      document.getElementById('eventEnd').value = inclusiveEnd;
      setStatusSelection(currentEvent.extendedProps.status);
      setTypeSelection(currentEvent.extendedProps.taskType);
      addEventModal.style.display = 'flex';
    },

    eventDrop: function(info) {
      const { id, title, start, end, extendedProps } = info.event;
      const payload = {
        title,
        description: extendedProps.description,
        start_date: toYMD(start),                         // date-only
        end_date: subOneDay(end ? toYMD(end) : toYMD(start)), // exclusive -> inclusive
        status: extendedProps.status,
        task_type: extendedProps.taskType,
      };
      fetchWithToken(`/events/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      }).then(() => calendar.refetchEvents())
        .catch(() => calendar.refetchEvents());
    },
    eventResize: function(info) {
      const { id, title, start, end, extendedProps } = info.event;
      const payload = {
        title,
        description: extendedProps.description,
        start_date: toYMD(start),
        end_date: subOneDay(toYMD(end)), // exclusive -> inclusive
        status: extendedProps.status,
        task_type: extendedProps.taskType,
      };
      fetchWithToken(`/events/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      }).then(() => calendar.refetchEvents())
        .catch(() => calendar.refetchEvents());
    },
  });

  const deleteEventButton = document.getElementById('deleteEventButton');

  deleteEventButton.onclick = async function() {
    if (!currentEvent) return;
    try {
      await fetchWithToken(`/events/${currentEvent.id}`, {
        method: 'DELETE',
      });
      calendar.refetchEvents();
      closeModal(addEventModal);
    } catch (error) {
      console.error('Failed to delete event', error);
    }
  }

  eventForm.onsubmit = async function(e) {
    e.preventDefault();
    const title = document.getElementById('eventTitle').value;
    const description = document.getElementById('eventDescription').value;
    const start = document.getElementById('eventStart').value; // already YYYY-MM-DD
    const end = document.getElementById('eventEnd').value;     // already YYYY-MM-DD
  
    if (start > end) {
      alert('End date must be after start date.');
      return;
    }
  
    const selectedStatus = document.querySelector('.status-option.selected');
    const status = selectedStatus ? selectedStatus.dataset.status : 'pending';
    const selectedType = document.querySelector('.type-option.selected');
    const taskType = selectedType ? selectedType.dataset.type : 'feature';

    const eventData = {
      title,
      description,
      start_date: start,     // inclusive
      end_date: end,         // inclusive
      status,
      task_type: taskType,
    };
  
    let url = '/events';
    let method = 'POST';
    if (currentEvent) {
      url += `/${currentEvent.id}`;
      method = 'PUT';
    }
  
    try {
      await fetchWithToken(url, {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(eventData),
      });
    } catch (error) {
      console.error('Failed to save event', error);
      return;
    }

    calendar.refetchEvents();
    closeModal(addEventModal);
  };

  document.querySelectorAll('.status-option').forEach(option => {
    option.addEventListener('click', () => {
      setStatusSelection(option.dataset.status);
    });
  });

  document.querySelectorAll('.type-option').forEach(option => {
    option.addEventListener('click', () => {
      setTypeSelection(option.dataset.type);
    });
  });

  applyTypeStyles();

  const addEventButton = document.getElementById('addEventButton');
  addEventButton.style.display = 'none';

  const loginForm = document.getElementById('loginForm');
  const checkDueTasksButton = document.getElementById('checkDueTasksButton');
  const telegramConfigButton = document.getElementById('telegramConfigButton');
  const telegramModal = document.getElementById('telegramModal');
  const getChatIdButton = document.getElementById('getChatIdButton');
  const testSendButton = document.getElementById('testSendButton');
  const saveTelegramConfigButton = document.getElementById('saveTelegramConfig');

  // Check if the user is already logged in
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');

  const completeLogin = () => {
    addEventButton.style.display = 'block';
    calendar.refetchEvents();
  };

  if (!refreshToken) {
    clearStoredTokens();
    loginModal.style.display = 'flex';
  } else if (!token) {
    attemptTokenRefresh().then(didRefresh => {
      if (didRefresh) {
        completeLogin();
      } else {
        loginModal.style.display = 'flex';
      }
    });
  } else {
    hasAuthError = false;
    scheduleTokenExpiryCheck(token);
    completeLogin();
  }

  loginForm.onsubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    startLoading();
    let response;
    try {
      response = await fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password }),
      });
    } finally {
      stopLoading();
    }

    if (response.ok) {
      const payload = await response.json();
      try {
        storeTokens(payload);
      } catch (error) {
        alert('Unable to start session. Please try again.');
        return;
      }
      closeModal(loginModal);
      completeLogin();
    } else {
      alert('Invalid username or password');
    }
  };

  const logoutButton = document.getElementById('logoutButton');
  logoutButton.onclick = async function() {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    clearStoredTokens();
    hasAuthError = false;
    if (storedRefreshToken) {
      await revokeRefreshToken(storedRefreshToken);
    }
    location.reload();
  };

  if (checkDueTasksButton) {
    checkDueTasksButton.onclick = async function() {
      try {
        const response = await fetchWithToken('/check-due-tasks', {
          method: 'POST',
        });
        const data = await response.json();
        alert(data.message);
      } catch (error) {
        alert('An error occurred while checking for due tasks.');
      }
    };
  }

  if (telegramConfigButton && telegramModal) {
    telegramConfigButton.addEventListener('click', async () => {
      try {
        const response = await fetchWithToken('/telegram-config');
        if (response.ok) {
          const config = await response.json();
          document.getElementById('botToken').value = config.bot_token || '';
          document.getElementById('chatId').value = config.chat_id || '';
        }
      } catch (err) {
        console.error('Failed to load telegram config', err);
      }
      telegramModal.style.display = 'flex';
    });
  }

  if (getChatIdButton) {
    getChatIdButton.onclick = async function() {
      const botToken = document.getElementById('botToken').value.trim();
      if (!botToken) {
        alert('Enter your bot token first.');
        return;
      }
      try {
        const response = await fetchWithToken(`/latest-chat-id?botToken=${encodeURIComponent(botToken)}`);
        const data = await response.json();
        if (response.ok && data.chatId) {
          document.getElementById('chatId').value = data.chatId;
        } else {
          alert(data.error || 'Unable to fetch chat ID.');
        }
      } catch (error) {
        alert('An error occurred while fetching the chat ID.');
      }
    };
  }

  if (testSendButton) {
    testSendButton.onclick = async function() {
      const botToken = document.getElementById('botToken').value.trim();
      const chatId = document.getElementById('chatId').value.trim();
      if (!botToken || !chatId) {
        alert('Enter both bot token and chat ID.');
        return;
      }
      try {
        const response = await fetchWithToken('/test-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botToken, chatId }),
        });
        const data = await response.json();
        alert(data.message || 'Test sent.');
      } catch (error) {
        alert('An error occurred while sending the test message.');
      }
    };
  }

  if (saveTelegramConfigButton) {
    saveTelegramConfigButton.onclick = async function() {
      const botToken = document.getElementById('botToken').value.trim();
      const chatId = document.getElementById('chatId').value.trim();
      if (!botToken || !chatId) {
        alert('Both bot token and chat ID are required.');
        return;
      }
      try {
        const response = await fetchWithToken('/telegram-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botToken, chatId }),
        });
        const data = await response.json();
        alert(data.message || 'Configuration saved.');
        closeModal(telegramModal);
      } catch (error) {
        alert('An error occurred while saving the configuration.');
      }
    };
  }

  addEventButton.onclick = function() {
    currentEvent = null;
    eventForm.reset();
    document.getElementById('modalTitle').innerText = 'Add Event';
    const today = toYMD(new Date());
    document.getElementById('eventStart').value = today;
    document.getElementById('eventEnd').value = getOneWeekLater(today);
    setStatusSelection('pending');
    addEventModal.style.display = 'flex';
  }

  calendar.render();
  initCollapsiblePanels();
});
