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
      const typeValue = (evt.task_type || evt.taskType || 'feature');
      const typeColor = getTypeColor(typeValue);
      const li = document.createElement('li');
      li.className = 'summary-item';
      li.dataset.type = typeValue;
      const statusOptions = TASK_STATUSES.map(({ value, label }) => `
        <option value="${value}" ${value === statusValue ? 'selected' : ''}>${label}</option>
      `).join('');
      li.innerHTML = `
        <span class="summary-dot" style="background:#fff; border:2px solid ${typeColor};"></span>
        <div class="summary-meta">
          <span class="summary-label">${evt.title || 'Untitled Task'}</span>
          <div class="summary-subrow">
            <span class="summary-type type-chip" style="color:${typeColor}; border-color:${typeColor};">${formatTypeLabel(typeValue)}</span>
            <select class="summary-status" data-id="${evt.id}">
              ${statusOptions}
            </select>
          </div>
        </div>
        <span class="summary-count">${moment(evt.start).format('MMM D')}</span>
      `;
      todaySummaryList.appendChild(li);
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
        return `
          <li>
            <span class="week-bullet" style="background:#fff; border:2px solid ${typeColor};"></span>
            <span class="week-task">${evt.title || 'Untitled Task'}</span>
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
      } finally {
        target.disabled = false;
        if (didUpdate) {
          calendar.refetchEvents();
        }
      }
    });
  }

  function fetchWithToken(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
    return fetch(url, { ...options, headers });
  }

  let calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
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
    if (currentEvent) {
      await fetchWithToken(`/events/${currentEvent.id}`, {
        method: 'DELETE',
      });
      calendar.refetchEvents();
      closeModal(addEventModal);
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
  
    await fetchWithToken(url, {
      method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(eventData),
    });
  
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
  if (!token) {
    loginModal.style.display = 'flex';
  } else {
    addEventButton.style.display = 'block';
    calendar.refetchEvents();
  }

  loginForm.onsubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const response = await fetch('/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const { token } = await response.json();
      localStorage.setItem('token', token);
      closeModal(loginModal);
      addEventButton.style.display = 'block';
      calendar.refetchEvents();
    } else {
      alert('Invalid username or password');
    }
  }

  const logoutButton = document.getElementById('logoutButton');
  logoutButton.onclick = function() {
    localStorage.removeItem('token');
    location.reload();
  }

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
});
