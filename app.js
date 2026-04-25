// ── Constants ───────────────────────────────────────────────────
const STORAGE_KEY = 'agenda-events';
const TAG_STORAGE_KEY = 'agenda-tags';
const FILTER_STORAGE_KEY = 'agenda-filters';
const SCHEMA_VERSION_KEY = 'agenda-schema-version';
const SCHEMA_VERSION = 1;
const DEFAULT_TAG_COLOR = '#6366f1';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SETTINGS_KEY = 'agenda-settings';

// ── DOM Refs ────────────────────────────────────────────────────
const form = document.getElementById('agenda-form');
const eventDate = document.getElementById('event-date');
const eventTitle = document.getElementById('event-title');
const eventStartTime = document.getElementById('event-start');
const eventEndTime = document.getElementById('event-end');
const eventLocation = document.getElementById('event-location');
const eventNotes = document.getElementById('event-notes');
const agendaList = document.getElementById('agenda-items');
const calendarTitle = document.getElementById('calendar-title');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const upcomingList = document.getElementById('upcoming-items');
const submitButton = document.getElementById('submit-button');
const cancelEditBtn = document.getElementById('cancel-edit');
const toast = document.getElementById('toast');
const eventTagsContainer = document.getElementById('event-tags');
const openTagsBtn = document.getElementById('open-tags');
const closeTagsBtn = document.getElementById('close-tags');
const tagDrawer = document.getElementById('tag-drawer');
const tagOverlay = document.getElementById('tag-overlay');
const tagForm = document.getElementById('tag-form');
const tagNameInput = document.getElementById('tag-name');
const tagColorInput = document.getElementById('tag-color');
const tagList = document.getElementById('tag-list');
const filterTagsContainer = document.getElementById('filter-tags');
const filterSearchInput = document.getElementById('filter-search');
const dayOverlay = document.getElementById('day-overlay');
const dayModal = document.getElementById('day-modal');
const dayModalTitle = document.getElementById('day-modal-title');
const dayModalList = document.getElementById('day-modal-list');
const closeDayModalBtn = document.getElementById('close-day-modal');
const exportBtn = document.getElementById('export-data');
const importBtn = document.getElementById('import-data');
const importFile = document.getElementById('import-file');
const eventRecurrence = document.getElementById('event-recurrence');
const eventRecurrenceEnd = document.getElementById('event-recurrence-end');
const recurrenceEndLabel = document.getElementById('recurrence-end-label');

// ── State ───────────────────────────────────────────────────────
const state = {
  currentMonth: new Date(),
  events: [],
  tags: [],
  editingId: null,
  filters: {
    search: '',
    tags: [],
  },
  selectedDay: null,
  lastFocusedDayIso: null,
  settings: {
    weekStartsOnMonday: null,
  },
};

let toastTimer = null;
let searchDebounceTimer = null;

// ── Initialization ──────────────────────────────────────────────
checkSchemaVersion();
setDefaultDate();
state.events = loadEvents();
state.tags = loadTags();
cleanOrphanTagRefs();

const savedFilters = loadFilters();
if (savedFilters) {
  state.filters.search = savedFilters.search;
  const availableTagIds = new Set(state.tags.map((tag) => tag.id));
  state.filters.tags = savedFilters.tags
    .filter((id) => availableTagIds.has(id))
    .filter((id, index, array) => array.indexOf(id) === index);
}

const savedSettings = loadSettings();
if (savedSettings) {
  state.settings.weekStartsOnMonday = savedSettings.weekStartsOnMonday;
} else {
  state.settings.weekStartsOnMonday = detectLocaleWeekStart();
  saveSettings(state.settings);
}

if (filterSearchInput) {
  filterSearchInput.value = state.filters.search;
}

renderTagOptions();
renderFilterTags();
renderTagList();
rerenderViews();
saveFilters(state.filters);
resetTagForm();

// ── Event Listeners ─────────────────────────────────────────────
if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    const wasEditing = Boolean(state.editingId);
    clearEditingState();
    resetFormFields();
    if (wasEditing) {
      showToast('Edit cancelled', 'info');
    }
  });
}

if (openTagsBtn) {
  openTagsBtn.addEventListener('click', openTagDrawer);
}
if (closeTagsBtn) {
  closeTagsBtn.addEventListener('click', closeTagDrawer);
}
if (tagOverlay) {
  tagOverlay.addEventListener('click', closeTagDrawer);
}

if (tagForm) {
  tagForm.addEventListener('submit', handleAddTag);
}

if (closeDayModalBtn) {
  closeDayModalBtn.addEventListener('click', closeDayModal);
}
if (dayOverlay) {
  dayOverlay.addEventListener('click', closeDayModal);
}

if (tagList) {
  tagList.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    if (event.target.dataset.action === 'delete-tag') {
      const { id } = event.target.dataset;
      if (id) {
        removeTag(id);
      }
    }
  });
}

if (filterTagsContainer) {
  filterTagsContainer.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.dataset.tagId) {
      toggleFilterTag(target.dataset.tagId, target.checked);
    }
  });
}

if (filterSearchInput) {
  filterSearchInput.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    state.filters.search = target.value;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      rerenderViews();
      saveFilters(state.filters);
    }, 250);
  });
}

if (eventRecurrence) {
  eventRecurrence.addEventListener('change', () => {
    const hasRecurrence = Boolean(eventRecurrence.value);
    if (recurrenceEndLabel) {
      recurrenceEndLabel.hidden = !hasRecurrence;
    }
    if (eventRecurrenceEnd && !hasRecurrence) {
      eventRecurrenceEnd.value = '';
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (state.selectedDay) {
      closeDayModal();
    } else if (tagDrawer?.classList.contains('open')) {
      closeTagDrawer();
    }
  }
});

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const dateValue = eventDate.value;
    const titleValue = eventTitle.value.trim();
    const startTimeValue = eventStartTime ? eventStartTime.value : '';
    const endTimeValue = eventEndTime ? eventEndTime.value : '';
    const selectedTags = getSelectedEventTagIds();
    const recurrenceValue = eventRecurrence ? eventRecurrence.value : '';
    const recurrenceEndValue = eventRecurrenceEnd ? eventRecurrenceEnd.value : '';
    if (!dateValue || !titleValue) {
      return;
    }

    if (startTimeValue && endTimeValue && endTimeValue < startTimeValue) {
      showToast('End time must be after start time', 'error');
      return;
    }

    const isEditing = Boolean(state.editingId);

    if (state.editingId) {
      const index = state.events.findIndex((item) => item.id === state.editingId);
      if (index !== -1) {
        state.events[index] = {
          ...state.events[index],
          date: dateValue,
          title: titleValue,
          startTime: startTimeValue,
          endTime: endTimeValue,
          location: eventLocation.value.trim(),
          notes: eventNotes.value.trim(),
          tags: selectedTags,
          recurrence: recurrenceValue || null,
          recurrenceEnd: recurrenceEndValue || null,
        };
      }
    } else {
      state.events.push({
        id: createId(),
        date: dateValue,
        title: titleValue,
        startTime: startTimeValue,
        endTime: endTimeValue,
        location: eventLocation.value.trim(),
        notes: eventNotes.value.trim(),
        tags: selectedTags,
        recurrence: recurrenceValue || null,
        recurrenceEnd: recurrenceEndValue || null,
      });
    }

    const saved = saveEvents(state.events);
    clearEditingState();
    resetFormFields({ keepDate: true });
    rerenderViews();
    if (saved) {
      showToast(isEditing ? 'Event updated' : 'Event added', 'success');
    }
  });
}

if (prevMonthBtn) {
  prevMonthBtn.addEventListener('click', () => {
    const current = state.currentMonth;
    state.currentMonth = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    renderCalendar();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener('click', () => {
    const current = state.currentMonth;
    state.currentMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    renderCalendar();
  });
}

// Calendar grid delegation (F2 fix — single handler instead of per-cell listeners)
if (calendarGrid) {
  calendarGrid.addEventListener('click', handleCalendarClick);
  calendarGrid.addEventListener('keydown', handleCalendarKeydown);
}

// Export / Import (D1/B1 fix)
if (exportBtn) {
  exportBtn.addEventListener('click', exportData);
}
if (importBtn && importFile) {
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', handleImportData);
}

// ── Calendar Delegation Handlers ────────────────────────────────
function handleCalendarClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const badge = target.closest('.event-number');
  if (badge instanceof HTMLElement) {
    event.stopPropagation();
    const cell = badge.closest('.calendar-cell');
    const isoDate = cell?.dataset?.date;
    if (isoDate) {
      state.lastFocusedDayIso = isoDate;
      const eventsForDay = getFilteredEvents(state.events)
        .filter((item) => item.date === isoDate)
        .sort(compareEvents);
      openDayModal(isoDate, eventsForDay);
    }
    return;
  }

  const cell = target.closest('.calendar-cell:not(.empty)');
  if (cell instanceof HTMLElement && cell.dataset.date) {
    selectCalendarDay(cell.dataset.date);
  }
}

function handleCalendarKeydown(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    const badge = target.closest('.event-number');
    if (badge instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      const cell = badge.closest('.calendar-cell');
      const isoDate = cell?.dataset?.date;
      if (isoDate) {
        state.lastFocusedDayIso = isoDate;
        const eventsForDay = getFilteredEvents(state.events)
          .filter((item) => item.date === isoDate)
          .sort(compareEvents);
        openDayModal(isoDate, eventsForDay);
      }
      return;
    }

    const cell = target.closest('.calendar-cell:not(.empty)');
    if (cell instanceof HTMLElement && cell.dataset.date) {
      event.preventDefault();
      selectCalendarDay(cell.dataset.date);
    }
    return;
  }

  // Arrow-key grid navigation (U5 fix)
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    const cell = target.closest('.calendar-cell:not(.empty)');
    if (!cell) {
      return;
    }
    event.preventDefault();
    const cells = Array.from(calendarGrid.querySelectorAll('.calendar-cell:not(.empty)'));
    const idx = cells.indexOf(cell);
    if (idx === -1) {
      return;
    }

    let next = idx;
    if (event.key === 'ArrowLeft') next = idx - 1;
    else if (event.key === 'ArrowRight') next = idx + 1;
    else if (event.key === 'ArrowUp') next = idx - 7;
    else if (event.key === 'ArrowDown') next = idx + 7;

    if (next >= 0 && next < cells.length) {
      cells[next].focus();
    }
  }
}

// ── Render Functions ────────────────────────────────────────────
function renderAgenda() {
  const sorted = getFilteredEvents(state.events).sort(compareEvents);
  agendaList.replaceChildren();

  const filtersActive = Boolean(state.filters.search) || state.filters.tags.length > 0;

  if (!sorted.length) {
    const empty = document.createElement('li');
    empty.textContent = state.events.length && filtersActive
      ? 'No events match the current filters.'
      : 'No events yet. Add your first one above!';
    agendaList.appendChild(empty);
    return;
  }

  for (const item of sorted) {
    const li = document.createElement('li');
    li.className = 'agenda-item';

    const content = buildEventContent(item);
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.append(createEditButton(item.id), createDeleteButton(item.id));

    li.append(content, actions);
    agendaList.appendChild(li);
  }
}

function renderUpcomingWeek() {
  if (!upcomingList) {
    return;
  }

  upcomingList.replaceChildren();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStartsOnMonday = state.settings.weekStartsOnMonday;
  const currentDay = today.getDay();
  let daysUntilEnd;
  if (weekStartsOnMonday) {
    daysUntilEnd = currentDay === 0 ? 0 : 7 - currentDay;
  } else {
    daysUntilEnd = 6 - currentDay;
  }

  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + daysUntilEnd);
  endOfWeek.setHours(23, 59, 59, 999);

  const upcoming = getFilteredEvents(state.events)
    .filter((item) => {
      const d = new Date(item.date + 'T00:00:00');
      if (Number.isNaN(d.getTime())) {
        return false;
      }
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      return dayStart >= today && dayStart <= endOfWeek;
    })
    .sort(compareEvents);

  const filtersActive = Boolean(state.filters.search) || state.filters.tags.length > 0;

  if (!upcoming.length) {
    const empty = document.createElement('li');
    const baseMessage = 'Nothing else scheduled this week.';
    empty.textContent = state.events.length && filtersActive
      ? `${baseMessage} Try adjusting your filters.`
      : baseMessage;
    upcomingList.appendChild(empty);
    return;
  }

  for (const item of upcoming) {
    const li = document.createElement('li');
    li.className = 'upcoming-item';

    const content = buildEventContent(item, 'upcoming-content');
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.append(createEditButton(item.id), createDeleteButton(item.id));

    li.append(content, actions);
    upcomingList.appendChild(li);
  }
}

function renderCalendar() {
  const current = state.currentMonth;
  const year = current.getFullYear();
  const month = current.getMonth();

  const monthName = current.toLocaleString('default', { month: 'long', year: 'numeric' });
  calendarTitle.textContent = monthName;
  calendarTitle.id = 'calendar-title-id';

  calendarGrid.replaceChildren();
  calendarGrid.setAttribute('aria-labelledby', 'calendar-title-id');

  const weekStartsOnMonday = state.settings.weekStartsOnMonday;
  const dayLabels = weekStartsOnMonday
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const filteredEvents = getFilteredEvents(state.events);

  const headerRow = document.createElement('div');
  headerRow.className = 'calendar-row calendar-header-row';
  headerRow.setAttribute('role', 'row');
  headerRow.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < dayLabels.length; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'calendar-label';
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-colindex', String(i + 1));
    cell.textContent = dayLabels[i];
    headerRow.appendChild(cell);
  }
  calendarGrid.appendChild(headerRow);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
  let startOffset = firstDayOfMonth.getDay();
  if (weekStartsOnMonday) {
    startOffset = startOffset === 0 ? 6 : startOffset - 1;
  }

  const totalCells = startOffset + lastDateOfMonth;
  const numWeeks = Math.ceil(totalCells / 7);

  for (let week = 0; week < numWeeks; week += 1) {
    const row = document.createElement('div');
    row.className = 'calendar-row';
    row.setAttribute('role', 'row');

    for (let col = 0; col < 7; col += 1) {
      const cellIndex = week * 7 + col;
      const day = cellIndex - startOffset + 1;

      if (cellIndex < startOffset || day > lastDateOfMonth) {
        const filler = document.createElement('div');
        filler.className = 'calendar-cell empty';
        filler.setAttribute('role', 'gridcell');
        filler.setAttribute('aria-hidden', 'true');
        filler.setAttribute('aria-colindex', String(col + 1));
        row.appendChild(filler);
      } else {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.tabIndex = 0;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-colindex', String(col + 1));

        const date = new Date(year, month, day);
        const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const number = document.createElement('span');
        number.className = 'date-number';
        number.textContent = day;
        number.setAttribute('aria-hidden', 'true');
        cell.appendChild(number);

        cell.dataset.date = isoDate;
        cell.setAttribute('aria-label', formatDate(isoDate));

        const eventsForDay = filteredEvents
          .filter((item) => item.date === isoDate)
          .sort(compareEvents);

        if (eventsForDay.length) {
          const badge = document.createElement('button');
          badge.type = 'button';
          badge.className = 'event-number';
          badge.textContent = `${eventsForDay.length}`;
          badge.setAttribute(
            'aria-label',
            `${eventsForDay.length} event${eventsForDay.length > 1 ? 's' : ''} on ${formatDate(isoDate)}`,
          );
          cell.appendChild(badge);
          cell.classList.add('has-events');
          cell.setAttribute('aria-describedby', `events-${isoDate}`);
        }

        if (isToday(date)) {
          cell.classList.add('today');
          cell.setAttribute('aria-current', 'date');
        }

        row.appendChild(cell);
      }
    }

    calendarGrid.appendChild(row);
  }
}

// F1 fix — parse ISO dates as local, not UTC
function formatDate(isoDate) {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildEventContent(item, className = 'agenda-content') {
  const container = document.createElement('div');
  container.className = className;

  const dateTimeValue = item.startTime ? `${item.date}T${item.startTime}` : item.date;
  const timeElement = document.createElement('time');
  timeElement.dateTime = dateTimeValue;
  timeElement.textContent = formatDate(item.date);
  container.appendChild(timeElement);

  const title = document.createElement('span');
  title.className = 'event-title';
  title.textContent = item.title;
  container.appendChild(title);

  if (item.startTime || item.endTime) {
    const timeMeta = document.createElement('span');
    timeMeta.className = 'event-meta';

    let label = '';
    if (item.startTime && item.endTime) {
      label = `${formatTime(item.startTime)} \u2013 ${formatTime(item.endTime)}`;
    } else if (item.startTime) {
      label = formatTime(item.startTime);
    } else if (item.endTime) {
      label = `Until ${formatTime(item.endTime)}`;
    }

    // Accessibility: wrap emoji in aria-hidden span
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u23F0 ';
    timeMeta.appendChild(icon);
    timeMeta.appendChild(document.createTextNode(label || 'All day'));
    container.appendChild(timeMeta);
  }

  if (item.location) {
    const meta = document.createElement('span');
    meta.className = 'event-meta';
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\uD83D\uDCCD ';
    meta.appendChild(icon);
    meta.appendChild(document.createTextNode(item.location));
    container.appendChild(meta);
  }

  if (item.notes) {
    const notes = document.createElement('p');
    notes.className = 'event-notes';
    notes.textContent = item.notes;
    container.appendChild(notes);
  }

  if (item.recurrence) {
    const recurrenceMeta = document.createElement('span');
    recurrenceMeta.className = 'event-meta recurrence-indicator';
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u{1F501} ';
    recurrenceMeta.appendChild(icon);
    const recurrenceLabels = {
      daily: 'Repeats daily',
      weekly: 'Repeats weekly',
      biweekly: 'Repeats every 2 weeks',
      monthly: 'Repeats monthly',
      yearly: 'Repeats yearly',
    };
    recurrenceMeta.appendChild(document.createTextNode(recurrenceLabels[item.recurrence] || 'Recurring'));
    container.appendChild(recurrenceMeta);
  }

  if (Array.isArray(item.tags) && item.tags.length) {
    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'event-tags';
    for (const tagId of item.tags) {
      const tag = state.tags.find((entry) => entry.id === tagId);
      if (!tag) {
        continue;
      }
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      const baseColor = normalizeHexColor(tag.color || DEFAULT_TAG_COLOR);
      chip.textContent = tag.name;
      chip.style.background = rgbaFromHex(baseColor, 0.2);
      chip.style.borderColor = rgbaFromHex(baseColor, 0.4);
      chip.style.color = getReadableTextColor(baseColor);
      tagsWrap.appendChild(chip);
    }

    if (tagsWrap.childElementCount) {
      container.appendChild(tagsWrap);
    }
  }

  return container;
}

function formatTime(value) {
  if (!value) {
    return '';
  }

  const [hours, minutes] = value.split(':');
  const date = new Date();
  date.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function compareEvents(a, b) {
  if (a.date !== b.date) {
    return a.date > b.date ? 1 : -1;
  }

  const aStart = a.startTime || '';
  const bStart = b.startTime || '';

  if (aStart && bStart && aStart !== bStart) {
    return aStart > bStart ? 1 : -1;
  }

  if (aStart && !bStart) {
    return -1;
  }

  if (!aStart && bStart) {
    return 1;
  }

  return a.title.localeCompare(b.title);
}

function getFilteredEvents(events) {
  const search = state.filters.search.trim().toLowerCase();
  const tagFilters = state.filters.tags;

  const expanded = expandRecurringEvents(events);

  return expanded.filter((event) => {
    if (search) {
      const haystack = [event.title, event.location, event.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (tagFilters.length) {
      if (!Array.isArray(event.tags) || !event.tags.some((id) => tagFilters.includes(id))) {
        return false;
      }
    }

    return true;
  });
}

function expandRecurringEvents(events) {
  const expanded = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxFutureDate = new Date(today);
  maxFutureDate.setFullYear(today.getFullYear() + 2);

  for (const event of events) {
    if (!event.recurrence) {
      expanded.push(event);
      continue;
    }

    const baseDate = new Date(event.date + 'T00:00:00');
    const endDate = event.recurrenceEnd
      ? new Date(event.recurrenceEnd + 'T23:59:59')
      : new Date(maxFutureDate);

    const instances = generateRecurrenceInstances(event, baseDate, endDate);
    expanded.push(...instances);
  }

  return expanded;
}

function generateRecurrenceInstances(event, startDate, endDate) {
  const instances = [];
  const interval = getRecurrenceInterval(event.recurrence);
  if (!interval) {
    instances.push(event);
    return instances;
  }

  const exclusions = new Set(event.recurrenceExclusions || []);
  const eventDate = new Date(startDate);
  let instanceCount = 0;
  const maxInstances = 500;

  while (eventDate <= endDate && instanceCount < maxInstances) {
    const isoDate = formatDateISO(eventDate);
    if (!exclusions.has(isoDate)) {
      instances.push({
        ...event,
        id: `${event.id}--${isoDate}`,
        date: isoDate,
        isRecurrenceInstance: true,
        originalEventId: event.id,
        originalDate: event.date,
      });
    }
    instanceCount++;

    advanceDate(eventDate, event.recurrence);
  }

  return instances;
}

function getRecurrenceInterval(recurrence) {
  const intervals = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 'monthly',
    yearly: 'yearly',
  };
  return intervals[recurrence] || null;
}

function advanceDate(date, recurrence) {
  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSelectedEventTagIds() {
  if (!eventTagsContainer) {
    return [];
  }

  return Array.from(eventTagsContainer.querySelectorAll('input[name="event-tags"]:checked')).map(
    (input) => input.value,
  );
}

function renderTagOptions(preselected) {
  if (!eventTagsContainer) {
    return;
  }

  let selectedIds = Array.isArray(preselected) ? [...preselected] : [];
  if (!preselected && state.editingId) {
    const editingEvent = state.events.find((item) => item.id === state.editingId);
    if (editingEvent && Array.isArray(editingEvent.tags)) {
      selectedIds = [...editingEvent.tags];
    }
  }
  if (!preselected && !state.editingId) {
    selectedIds = getSelectedEventTagIds();
  }

  eventTagsContainer.replaceChildren();

  if (!state.tags.length) {
    const empty = document.createElement('p');
    empty.className = 'event-meta';
    empty.textContent = 'No tags yet. Use Manage Tags to create some.';
    eventTagsContainer.appendChild(empty);
    return;
  }

  const sorted = [...state.tags].sort((a, b) => a.name.localeCompare(b.name));

  for (const tag of sorted) {
    const label = document.createElement('label');
    label.className = 'tag-option';

    const baseColor = normalizeHexColor(tag.color || DEFAULT_TAG_COLOR);
    label.style.borderColor = rgbaFromHex(baseColor, 0.4);
    label.style.background = rgbaFromHex(baseColor, 0.12);
    label.style.color = getReadableTextColor(baseColor);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'event-tags';
    input.value = tag.id;
    input.checked = selectedIds.includes(tag.id);
    input.style.accentColor = baseColor;

    const swatch = document.createElement('span');
    swatch.className = 'tag-color-swatch';
    swatch.style.background = baseColor;

    const span = document.createElement('span');
    span.textContent = tag.name;
    span.style.color = getReadableTextColor(baseColor);

    label.append(input, swatch, span);
    eventTagsContainer.appendChild(label);
  }
}

function renderFilterTags() {
  if (!filterTagsContainer) {
    return;
  }

  filterTagsContainer.replaceChildren();

  if (!state.tags.length) {
    const empty = document.createElement('span');
    empty.className = 'event-meta';
    empty.textContent = 'No tags to filter yet';
    filterTagsContainer.appendChild(empty);
    return;
  }

  const sorted = [...state.tags].sort((a, b) => a.name.localeCompare(b.name));

  for (const tag of sorted) {
    const label = document.createElement('label');
    label.className = 'tag-chip';

    const baseColor = normalizeHexColor(tag.color || DEFAULT_TAG_COLOR);
    label.style.background = rgbaFromHex(baseColor, 0.16);
    label.style.border = `1px solid ${rgbaFromHex(baseColor, 0.35)}`;
    label.style.color = getReadableTextColor(baseColor);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.tagId = tag.id;
    input.checked = state.filters.tags.includes(tag.id);
    input.style.accentColor = baseColor;

    const swatch = document.createElement('span');
    swatch.className = 'tag-color-swatch';
    swatch.style.background = baseColor;

    const span = document.createElement('span');
    span.textContent = tag.name;
    span.style.color = getReadableTextColor(baseColor);

    label.append(input, swatch, span);
    filterTagsContainer.appendChild(label);
  }
}

function renderTagList() {
  if (!tagList) {
    return;
  }

  tagList.replaceChildren();

  if (!state.tags.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No tags yet. Add your first tag above.';
    tagList.appendChild(empty);
    return;
  }

  const sorted = [...state.tags].sort((a, b) => a.name.localeCompare(b.name));

  for (const tag of sorted) {
    const li = document.createElement('li');

    const info = document.createElement('span');
    const usageCount = state.events.filter((event) => event.tags?.includes(tag.id)).length;
    info.textContent = usageCount ? `${tag.name} (${usageCount})` : tag.name;

    const controls = document.createElement('div');
    controls.className = 'tag-row-controls';

    const swatch = document.createElement('span');
    swatch.className = 'tag-color-swatch';
    swatch.style.background = normalizeHexColor(tag.color || DEFAULT_TAG_COLOR);

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'delete-tag';
    button.dataset.id = tag.id;
    button.textContent = 'Remove';
    if (usageCount) {
      button.title = 'Removing will unassign this tag from events';
    }

    controls.append(swatch, button);
    li.append(info, controls);
    tagList.appendChild(li);
  }
}

function toggleFilterTag(tagId, enabled) {
  if (!tagId) {
    return;
  }

  if (enabled) {
    if (!state.filters.tags.includes(tagId)) {
      state.filters.tags.push(tagId);
    }
  } else {
    state.filters.tags = state.filters.tags.filter((id) => id !== tagId);
  }

  rerenderViews();
  saveFilters(state.filters);
}

function handleAddTag(event) {
  event.preventDefault();
  if (!tagNameInput) {
    return;
  }

  const name = tagNameInput.value.trim();
  if (!name) {
    return;
  }

  const exists = state.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast('Tag already exists', 'error');
    return;
  }

  const color = normalizeHexColor(tagColorInput ? tagColorInput.value : DEFAULT_TAG_COLOR);

  const newTag = {
    id: createId(),
    name,
    color,
  };

  state.tags.push(newTag);
  const selectedBefore = getSelectedEventTagIds();
  const saved = saveTags(state.tags);
  renderTagOptions(selectedBefore);
  renderFilterTags();
  renderTagList();
  if (tagForm) {
    tagForm.reset();
  }
  resetTagForm();
  if (saved) {
    showToast('Tag added', 'success');
  }
}

// U3 fix — undo toast pattern instead of confirm()
function removeTag(tagId) {
  const tag = state.tags.find((t) => t.id === tagId);
  const tagName = tag?.name || 'tag';

  const previousTags = [...state.tags];
  const previousEvents = [...state.events];
  const previousFilterTags = [...state.filters.tags];

  state.tags = state.tags.filter((t) => t.id !== tagId);
  state.filters.tags = state.filters.tags.filter((id) => id !== tagId);

  state.events = state.events.map((event) => {
    if (!Array.isArray(event.tags)) {
      return event;
    }
    if (!event.tags.includes(tagId)) {
      return event;
    }
    return {
      ...event,
      tags: event.tags.filter((id) => id !== tagId),
    };
  });

  saveTags(state.tags);
  saveEvents(state.events);
  saveFilters(state.filters);
  renderTagOptions();
  renderFilterTags();
  renderTagList();
  rerenderViews();

  showToast(`"${tagName}" removed`, 'info', () => {
    state.tags = previousTags;
    state.filters.tags = previousFilterTags;
    state.events = previousEvents;
    saveTags(state.tags);
    saveEvents(state.events);
    saveFilters(state.filters);
    renderTagOptions();
    renderFilterTags();
    renderTagList();
    rerenderViews();
    showToast('Tag restored', 'success');
  });
}

function openTagDrawer() {
  if (tagDrawer) {
    tagDrawer.classList.add('open');
    tagDrawer.setAttribute('aria-hidden', 'false');
  }
  if (tagOverlay) {
    tagOverlay.hidden = false;
  }
  if (openTagsBtn) {
    openTagsBtn.setAttribute('aria-expanded', 'true');
  }
  if (tagNameInput) {
    tagNameInput.focus();
  }
}

function closeTagDrawer() {
  if (tagDrawer) {
    tagDrawer.classList.remove('open');
    tagDrawer.setAttribute('aria-hidden', 'true');
  }
  if (tagOverlay) {
    tagOverlay.hidden = true;
  }
  if (openTagsBtn) {
    openTagsBtn.setAttribute('aria-expanded', 'false');
  }
  if (tagForm) {
    tagForm.reset();
  }
  resetTagForm();
}

function rerenderViews() {
  renderAgenda();
  renderCalendar();
  renderUpcomingWeek();
  if (state.selectedDay) {
    const currentEvents = getFilteredEvents(state.events)
      .filter((event) => event.date === state.selectedDay)
      .sort(compareEvents);
    if (currentEvents.length) {
      renderDayModalContent(state.selectedDay, currentEvents);
    } else {
      closeDayModal();
    }
  }
}

function resetTagForm() {
  if (tagNameInput) {
    tagNameInput.value = '';
  }
  if (tagColorInput) {
    tagColorInput.value = DEFAULT_TAG_COLOR;
  }
}

function selectCalendarDay(isoDate) {
  if (eventDate) {
    eventDate.value = isoDate;
  }
  closeDayModal();
  if (eventTitle) {
    eventTitle.focus();
  }
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDayModal(isoDate, events) {
  if (eventDate) {
    eventDate.value = isoDate;
  }
  state.selectedDay = isoDate;
  renderDayModalContent(isoDate, events);
  if (dayOverlay) {
    dayOverlay.hidden = false;
  }
  if (dayModal) {
    dayModal.hidden = false;
    dayModal.setAttribute('aria-hidden', 'false');
  }
  if (closeDayModalBtn) {
    closeDayModalBtn.focus();
  }
}

function renderDayModalContent(isoDate, events) {
  if (!dayModal || !dayModalList || !dayModalTitle) {
    return;
  }

  state.selectedDay = isoDate;

  const sortedEvents = events.slice().sort(compareEvents);
  const titleDate = new Date(isoDate + 'T00:00:00');
  dayModalTitle.textContent = titleDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  dayModalList.replaceChildren();

  if (!sortedEvents.length) {
    const empty = document.createElement('li');
    empty.className = 'day-modal__event';
    empty.textContent = 'No events for this day.';
    dayModalList.appendChild(empty);
    return;
  }

  for (const event of sortedEvents) {
    const li = document.createElement('li');
    li.className = 'day-modal__event';

    const content = buildEventContent(event, 'day-modal__event-content');
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.append(createEditButton(event.id), createDeleteButton(event.id));

    li.append(content, actions);
    dayModalList.appendChild(li);
  }
}

// S2 fix — validate lastFocusedDayIso before using in querySelector
function closeDayModal() {
  state.selectedDay = null;
  if (dayOverlay) {
    dayOverlay.hidden = true;
  }
  if (dayModal) {
    dayModal.hidden = true;
    dayModal.setAttribute('aria-hidden', 'true');
  }
  if (dayModalList) {
    dayModalList.replaceChildren();
  }
  if (state.lastFocusedDayIso && ISO_DATE_RE.test(state.lastFocusedDayIso)) {
    const focusTarget = calendarGrid?.querySelector(
      `.calendar-cell[data-date="${state.lastFocusedDayIso}"]`,
    );
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus();
    }
  }
  state.lastFocusedDayIso = null;
}

function isToday(date) {
  const today = new Date();
  return (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  );
}

// S3 fix — use crypto.randomUUID when available
function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Storage Functions ───────────────────────────────────────────
function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => typeof item?.date === 'string' && typeof item?.title === 'string')
      .map((item) => ({
        ...item,
        startTime: typeof item.startTime === 'string' ? item.startTime : '',
        endTime: typeof item.endTime === 'string' ? item.endTime : '',
        location: typeof item.location === 'string' ? item.location : '',
        notes: typeof item.notes === 'string' ? item.notes : '',
        tags: Array.isArray(item.tags)
          ? item.tags.filter((tagId) => typeof tagId === 'string')
          : [],
        recurrence: typeof item.recurrence === 'string' ? item.recurrence : null,
        recurrenceEnd: typeof item.recurrenceEnd === 'string' ? item.recurrenceEnd : null,
        recurrenceExclusions: Array.isArray(item.recurrenceExclusions)
          ? item.recurrenceExclusions.filter((d) => typeof d === 'string')
          : [],
      }));
  } catch (error) {
    console.error('Failed to load events from storage', error);
    showToast('Could not load saved events', 'error');
    return [];
  }
}

function saveEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch (error) {
    console.error('Failed to save events to storage', error);
    showToast('Saving to storage failed', 'error');
    return false;
  }
}

function loadTags() {
  try {
    const raw = localStorage.getItem(TAG_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => typeof item?.id === 'string' && typeof item?.name === 'string')
      .map((item) => ({
        id: item.id,
        name: item.name,
        color: typeof item.color === 'string' ? item.color : DEFAULT_TAG_COLOR,
      }));
  } catch (error) {
    console.error('Failed to load tags from storage', error);
    showToast('Could not load tags', 'error');
    return [];
  }
}

function saveTags(tags) {
  try {
    localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(tags));
    return true;
  } catch (error) {
    console.error('Failed to save tags to storage', error);
    showToast('Saving tags failed', 'error');
    return false;
  }
}

// D6 fix — clear corrupted filter entry from localStorage on parse error
function loadFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const search = typeof parsed.search === 'string' ? parsed.search : '';
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((id) => typeof id === 'string')
      : [];

    return { search, tags };
  } catch (error) {
    console.error('Failed to load filters from storage', error);
    localStorage.removeItem(FILTER_STORAGE_KEY);
    return null;
  }
}

function saveFilters(filters) {
  try {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        search: filters.search,
        tags: filters.tags,
      }),
    );
    return true;
  } catch (error) {
    console.error('Failed to save filters to storage', error);
    return false;
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      weekStartsOnMonday:
        typeof parsed.weekStartsOnMonday === 'boolean' ? parsed.weekStartsOnMonday : null,
    };
  } catch {
    return null;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

function detectLocaleWeekStart() {
  try {
    const locale = navigator.language || 'en-US';
    const parts = new Intl.Locale(locale);
    const region = parts.region || 'US';
    const weekInfo = new Intl.Locale(locale, { calendar: 'gregory' }).getWeekInfo?.();
    if (weekInfo && typeof weekInfo.firstDay === 'number') {
      return weekInfo.firstDay === 1;
    }
    const mondayStartRegions = new Set([
      'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR',
      'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MT', 'NL', 'NO', 'PL',
      'PT', 'RO', 'SE', 'SI', 'SK', 'SM', 'VA', 'AD', 'AX', 'BL', 'FO', 'GF', 'GP', 'MF',
      'MQ', 'NC', 'PF', 'PM', 'RE', 'WF', 'YT',
    ]);
    return mondayStartRegions.has(region);
  } catch {
    return false;
  }
}

// D5/B5 fix — schema version tracking for future migrations
function checkSchemaVersion() {
  const stored = localStorage.getItem(SCHEMA_VERSION_KEY);
  const version = stored ? parseInt(stored, 10) : 0;

  if (version < SCHEMA_VERSION) {
    // Future migrations would be handled here based on version number.
    localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
  }
}

// D3 fix — remove orphan tag references from events
function cleanOrphanTagRefs() {
  const validTagIds = new Set(state.tags.map((t) => t.id));
  let changed = false;

  state.events = state.events.map((event) => {
    if (!Array.isArray(event.tags)) {
      return event;
    }
    const cleaned = event.tags.filter((id) => validTagIds.has(id));
    if (cleaned.length !== event.tags.length) {
      changed = true;
      return { ...event, tags: cleaned };
    }
    return event;
  });

  if (changed) {
    saveEvents(state.events);
  }
}

// ── UI Helpers ──────────────────────────────────────────────────
function createDeleteButton(event) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'item-remove';
  button.textContent = 'Delete';
  button.addEventListener('click', () => {
    if (event.isRecurrenceInstance) {
      handleDeleteRecurrenceInstance(event);
    } else {
      handleDeleteEvent(event.id);
    }
  });
  button.setAttribute('aria-label', 'Delete event');
  return button;
}

function createEditButton(event) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'item-edit';
  button.textContent = 'Edit';
  button.addEventListener('click', () => {
    if (event.isRecurrenceInstance) {
      startEditingEvent(event.originalEventId);
    } else {
      startEditingEvent(event.id);
    }
  });
  button.setAttribute('aria-label', 'Edit event');
  return button;
}

function handleDeleteRecurrenceInstance(instance) {
  const originalEvent = state.events.find((e) => e.id === instance.originalEventId);
  if (!originalEvent) {
    handleDeleteEvent(instance.id);
    return;
  }

  const previousEvents = [...state.events];
  const exclusionDate = instance.date;

  const exclusions = originalEvent.recurrenceExclusions || [];
  if (!exclusions.includes(exclusionDate)) {
    exclusions.push(exclusionDate);
  }

  const index = state.events.findIndex((e) => e.id === instance.originalEventId);
  if (index !== -1) {
    state.events[index] = {
      ...state.events[index],
      recurrenceExclusions: exclusions,
    };
  }

  saveEvents(state.events);
  rerenderViews();

  showToast('Instance deleted', 'info', () => {
    state.events = previousEvents;
    saveEvents(state.events);
    rerenderViews();
    showToast('Instance restored', 'success');
  });
}

// U3 fix — undo toast pattern instead of confirm()
function handleDeleteEvent(id) {
  const eventToDelete = state.events.find((item) => item.id === id);
  if (!eventToDelete) {
    return;
  }

  const previousEvents = [...state.events];
  state.events = state.events.filter((item) => item.id !== id);

  if (state.editingId === id) {
    clearEditingState();
    resetFormFields();
  }

  const saved = saveEvents(state.events);
  rerenderViews();

  if (saved) {
    showToast('Event deleted', 'info', () => {
      state.events = previousEvents;
      saveEvents(state.events);
      rerenderViews();
      showToast('Event restored', 'success');
    });
  }
}

function startEditingEvent(id) {
  const target = state.events.find((item) => item.id === id);
  if (!target) {
    return;
  }

  closeDayModal();

  state.editingId = id;
  eventDate.value = target.date;
  eventTitle.value = target.title;
  if (eventLocation) {
    eventLocation.value = target.location || '';
  }
  if (eventNotes) {
    eventNotes.value = target.notes || '';
  }
  if (eventStartTime) {
    eventStartTime.value = target.startTime || '';
  }
  if (eventEndTime) {
    eventEndTime.value = target.endTime || '';
  }
  if (eventRecurrence) {
    eventRecurrence.value = target.recurrence || '';
    const hasRecurrence = Boolean(target.recurrence);
    if (recurrenceEndLabel) {
      recurrenceEndLabel.hidden = !hasRecurrence;
    }
  }
  if (eventRecurrenceEnd) {
    eventRecurrenceEnd.value = target.recurrenceEnd || '';
  }
  renderTagOptions(target.tags || []);
  if (submitButton) {
    submitButton.textContent = 'Save Changes';
  }
  if (cancelEditBtn) {
    cancelEditBtn.hidden = false;
  }
  eventTitle.focus();
}

function clearEditingState() {
  state.editingId = null;
  if (submitButton) {
    submitButton.textContent = 'Add';
  }
  if (cancelEditBtn) {
    cancelEditBtn.hidden = true;
  }
}

function resetFormFields(options = {}) {
  const { keepDate = false } = options;
  eventTitle.value = '';
  if (eventStartTime) {
    eventStartTime.value = '';
  }
  if (eventEndTime) {
    eventEndTime.value = '';
  }
  if (eventLocation) {
    eventLocation.value = '';
  }
  if (eventNotes) {
    eventNotes.value = '';
  }
  if (eventRecurrence) {
    eventRecurrence.value = '';
  }
  if (eventRecurrenceEnd) {
    eventRecurrenceEnd.value = '';
  }
  if (recurrenceEndLabel) {
    recurrenceEndLabel.hidden = true;
  }
  renderTagOptions([]);
  if (!keepDate) {
    setDefaultDate();
  }
  eventTitle.focus();
}

// F1 fix — use local date components instead of toISOString (which is UTC)
function getLocalISODate(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function setDefaultDate() {
  eventDate.value = getLocalISODate();
}

function showToast(message, variant = 'info', onUndo = null) {
  if (!toast || !message) {
    return;
  }

  const safeVariant = ['success', 'error', 'info'].includes(variant) ? variant : 'info';
  toast.textContent = message;
  toast.className = `toast toast--${safeVariant}`;

  toast.replaceChildren();
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (onUndo && typeof onUndo === 'function') {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'toast-undo';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', () => {
      onUndo();
      toast.classList.remove('show');
      clearTimeout(toastTimer);
    });
    toast.appendChild(undoBtn);
  }

  void toast.offsetWidth;

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ── Export / Import (D1/B1 fix) ─────────────────────────────────
function exportData() {
  const data = {
    version: SCHEMA_VERSION,
    events: state.events,
    tags: state.tags,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agenda-backup-${getLocalISODate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported', 'success');
}

function handleImportData(event) {
  const file = event.target?.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid format');
      }

      const events = Array.isArray(data.events) ? data.events : [];
      const tags = Array.isArray(data.tags) ? data.tags : [];

      state.events = events
        .filter((item) => typeof item?.date === 'string' && typeof item?.title === 'string')
        .map((item) => ({
          ...item,
          startTime: typeof item.startTime === 'string' ? item.startTime : '',
          endTime: typeof item.endTime === 'string' ? item.endTime : '',
          location: typeof item.location === 'string' ? item.location : '',
          notes: typeof item.notes === 'string' ? item.notes : '',
          tags: Array.isArray(item.tags)
            ? item.tags.filter((id) => typeof id === 'string')
            : [],
        }));

      state.tags = tags
        .filter((item) => typeof item?.id === 'string' && typeof item?.name === 'string')
        .map((item) => ({
          id: item.id,
          name: item.name,
          color: typeof item.color === 'string' ? item.color : DEFAULT_TAG_COLOR,
        }));

      saveEvents(state.events);
      saveTags(state.tags);

      state.filters = { search: '', tags: [] };
      if (filterSearchInput) {
        filterSearchInput.value = '';
      }
      saveFilters(state.filters);

      renderTagOptions();
      renderFilterTags();
      renderTagList();
      rerenderViews();

      showToast(`Imported ${state.events.length} events and ${state.tags.length} tags`, 'success');
    } catch (err) {
      console.error('Import failed', err);
      showToast('Invalid backup file', 'error');
    }
    // Reset file input so the same file can be re-imported
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ── Color Utilities ─────────────────────────────────────────────
function normalizeHexColor(value) {
  if (typeof value !== 'string') {
    return DEFAULT_TAG_COLOR;
  }

  let hex = value.trim().toLowerCase();
  if (!hex) {
    return DEFAULT_TAG_COLOR;
  }

  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return DEFAULT_TAG_COLOR;
  }

  return `#${hex}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  const int = parseInt(normalized.slice(1), 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
    hex: normalized,
  };
}

function rgbaFromHex(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  const safeAlpha = Math.max(0, Math.min(alpha, 1));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

function getReadableTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return luminance > 0.55 ? '#1f2937' : '#f8fafc';
}

// ── Service Worker Registration (PWA) ───────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
