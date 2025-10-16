document.addEventListener('DOMContentLoaded', function() {
  const currentYear = new Date().getFullYear();
  document.getElementById('currentYear').textContent = currentYear;
  const calendarEl = document.getElementById('calendar');
  const addEventModal = document.getElementById('eventModal');
  const addEventCloseButton = addEventModal.querySelector('.close-button');
  const eventForm = document.getElementById('eventForm');
  let currentEvent = null;




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
  const statusColors = {
    'pending':    '#FFC107', // Amber
    'in-progress':'#03A9F4', // Light Blue
    'completed':  '#4CAF50',  // Green
    'bugged':     '#F44336',   // Red
    'announcement': '#9C27B0', // Purple
    'scheduled-task': '#000000' // Black
  };

  const filterOptions = document.querySelector('.filter-options');

  // Load saved statuses from local storage
  const savedStatuses = JSON.parse(localStorage.getItem('calendar_filters'));

  for (const status in statusColors) {
    const color = statusColors[status];
    const option = document.createElement('label');
    const isChecked = savedStatuses ? savedStatuses.includes(status) : true;
    const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
    option.innerHTML = `
      <input type="checkbox" class="status-filter" value="${status}" ${isChecked ? 'checked' : ''} style="display: none;">
      <span class="status-chip is-${status} ${!isChecked ? 'selected' : ''}"><span class="status-text">${statusText}${isChecked ? ' ✓' : ''}</span></span>
    `;
    filterOptions.appendChild(option);
  }

  const selectAllCheckbox = document.getElementById('select-all-filters');

  function updateSelectAllCheckbox() {
    const allFilters = document.querySelectorAll('.status-filter');
    const allChecked = Array.from(allFilters).every(filter => filter.checked);
    selectAllCheckbox.checked = allChecked;
  }

  selectAllCheckbox.addEventListener('change', (e) => {
    const allFilters = document.querySelectorAll('.status-filter');
    allFilters.forEach(filter => {
      filter.checked = e.target.checked;
      const chip = filter.nextElementSibling;
      chip.classList.toggle('selected', !filter.checked);
    });
    const selectedStatuses = Array.from(document.querySelectorAll('.status-filter:checked')).map(cb => cb.value);
    localStorage.setItem('calendar_filters', JSON.stringify(selectedStatuses));
    calendar.refetchEvents();
  });

  filterOptions.addEventListener('change', (e) => {
    if (e.target.classList.contains('status-filter')) {
      const chip = e.target.nextElementSibling;
      chip.classList.toggle('selected', !e.target.checked);
      const statusText = chip.querySelector('.status-text');
      if (e.target.checked) {
        statusText.textContent += ' ✓';
      } else {
        statusText.textContent = statusText.textContent.replace(' ✓', '');
      }
      updateSelectAllCheckbox();
      const selectedStatuses = Array.from(document.querySelectorAll('.status-filter:checked')).map(cb => cb.value);
      localStorage.setItem('calendar_filters', JSON.stringify(selectedStatuses));
      calendar.refetchEvents();
    }
  });

  document.getElementById('eventStart').addEventListener('change', (e) => {
    const newEndDate = getOneWeekLater(e.target.value);
    document.getElementById('eventEnd').value = newEndDate;
  });

  function getOneWeekLater(dateStr) {
    return moment(dateStr).add(1, 'week').format('YYYY-MM-DD');
  }

  updateSelectAllCheckbox();

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
      const selectedStatuses = Array.from(document.querySelectorAll('.status-filter:checked')).map(cb => cb.value);
      const statusesQuery = selectedStatuses.map(s => `statuses[]=${s}`).join('&');
      fetchWithToken(`/events?${statusesQuery}`)
        .then(response => response.json())
        .then(data => {
          console.log('Data from server:', data);
          const events = data.map(evt => ({
            id: evt.id,
            title: evt.title,
            start: evt.start,               // 'YYYY-MM-DD'
            end: addOneDay(evt.end),        // make it exclusive for FC
            allDay: true,
            extendedProps: {
              description: evt.description,
              status: evt.status
            }
          }));
          console.log('Events passed to successCallback:', events);
          successCallback(events);
        })
        .catch(error => failureCallback(error));
    },
    dateClick: function(info) {
      currentEvent = null;
      eventForm.reset();
      document.getElementById('modalTitle').innerText = 'Add Event';
      document.getElementById('eventStart').value = info.dateStr;
      document.getElementById('eventEnd').value = getOneWeekLater(info.dateStr);
      addEventModal.style.display = 'block';
    },

    eventDidMount: function(info) {
      const statusColor = statusColors[info.event.extendedProps.status];
      info.el.style.background = `linear-gradient(to right, ${statusColor}, ${statusColor}a0)`;
    },

    eventClick: function(info) {
      currentEvent = info.event;
      document.getElementById('modalTitle').innerText = 'Edit Event';
      document.getElementById('eventTitle').value = currentEvent.title;
      document.getElementById('eventDescription').value = currentEvent.extendedProps.description || '';
      document.getElementById('eventStart').value = toYMD(currentEvent.start);
      const inclusiveEnd = currentEvent.end ? subOneDay(toYMD(currentEvent.end)) : toYMD(currentEvent.start);
      document.getElementById('eventEnd').value = inclusiveEnd;
      document.querySelectorAll('.status-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.status === currentEvent.extendedProps.status);
      });
      addEventModal.style.display = 'block';
    },

    eventDrop: function(info) {
      const { id, title, start, end, extendedProps } = info.event;
      const payload = {
        title,
        description: extendedProps.description,
        start_date: toYMD(start),                         // date-only
        end_date: subOneDay(end ? toYMD(end) : toYMD(start)), // exclusive -> inclusive
        status: extendedProps.status
      };
      fetchWithToken(`/events/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
    },
    eventResize: function(info) {
      const { id, title, start, end, extendedProps } = info.event;
      const payload = {
        title,
        description: extendedProps.description,
        start_date: toYMD(start),
        end_date: subOneDay(toYMD(end)), // exclusive -> inclusive
        status: extendedProps.status
      };
      fetchWithToken(`/events/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
    },
  });

  const deleteEventButton = document.getElementById('deleteEventButton');

  deleteEventButton.onclick = async function() {
    if (currentEvent) {
      await fetchWithToken(`/events/${currentEvent.id}`, {
        method: 'DELETE',
      });
      calendar.refetchEvents();
      addEventModal.style.display = 'none';
    }
  }

  calendar.render();

  const addEventButton = document.getElementById('addEventButton');
  addEventButton.style.display = 'none';

  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');

  // Check if the user is already logged in
  const token = localStorage.getItem('token');
  if (!token) {
    loginModal.style.display = 'block';
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
      loginModal.style.display = 'none';
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
  }
});
