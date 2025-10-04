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

const STORAGE_KEY = 'agenda-events';
const TAG_STORAGE_KEY = 'agenda-tags';
const FILTER_STORAGE_KEY = 'agenda-filters';

const DEFAULT_TAG_COLOR = '#6366f1';

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
};

let toastTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  state.events = loadEvents();
  state.tags = loadTags();

  const savedFilters = loadFilters();
  if (savedFilters) {
    state.filters.search = savedFilters.search;
    const availableTagIds = new Set(state.tags.map((tag) => tag.id));
    state.filters.tags = savedFilters.tags
      .filter((id) => availableTagIds.has(id))
      .filter((id, index, array) => array.indexOf(id) === index);
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

  if (eventTagsContainer) {
    eventTagsContainer.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      if (target.name === 'event-tags') {
        // no-op hook to keep future logic consistent
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
      rerenderViews();
      saveFilters(state.filters);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.selectedDay) {
      closeDayModal();
    }
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const dateValue = eventDate.value;
  const titleValue = eventTitle.value.trim();
  const startTimeValue = eventStartTime ? eventStartTime.value : '';
  const endTimeValue = eventEndTime ? eventEndTime.value : '';
  const selectedTags = getSelectedEventTagIds();
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

prevMonthBtn.addEventListener('click', () => {
  const current = state.currentMonth;
  state.currentMonth = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  const current = state.currentMonth;
  state.currentMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  renderCalendar();
});

function renderAgenda() {
  const sorted = getFilteredEvents([...state.events]).sort(compareEvents);
  agendaList.innerHTML = '';

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

  upcomingList.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const upcoming = getFilteredEvents([...state.events])
    .map((item) => ({
      ...item,
      dateObj: new Date(item.date),
    }))
    .filter((item) => {
      const eventDate = item.dateObj;
      if (Number.isNaN(eventDate.getTime())) {
        return false;
      }
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today && eventDate <= endOfWeek;
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

  calendarGrid.innerHTML = '';
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const filteredEvents = getFilteredEvents([...state.events]);

  for (const label of dayLabels) {
    const cell = document.createElement('div');
    cell.className = 'calendar-label';
    cell.textContent = label;
    calendarGrid.appendChild(cell);
  }

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDayOfMonth.getDay();

  for (let i = 0; i < startOffset; i += 1) {
    const filler = document.createElement('div');
    filler.className = 'calendar-cell empty';
    calendarGrid.appendChild(filler);
  }

  for (let day = 1; day <= lastDateOfMonth; day += 1) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';

    const date = new Date(year, month, day);
    const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const number = document.createElement('span');
    number.className = 'date-number';
    number.textContent = day;
    cell.appendChild(number);

    cell.dataset.date = isoDate;
    cell.addEventListener('click', () => selectCalendarDay(isoDate));

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
      badge.addEventListener('click', (event) => {
        event.stopPropagation();
        state.lastFocusedDayIso = isoDate;
        openDayModal(isoDate, eventsForDay);
      });
      badge.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          state.lastFocusedDayIso = isoDate;
          openDayModal(isoDate, eventsForDay);
        }
      });
      cell.appendChild(badge);
      cell.classList.add('has-events');
      cell.style.cursor = 'pointer';
    } else {
      cell.classList.remove('has-events');
      cell.style.cursor = 'default';
      if (state.lastFocusedDayIso === isoDate) {
        state.lastFocusedDayIso = null;
      }
      const existingBadge = cell.querySelector('.event-number');
      if (existingBadge) {
        existingBadge.remove();
      }
    }

    if (isToday(date)) {
      cell.classList.add('today');
    }

    calendarGrid.appendChild(cell);
  }
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
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
  title.textContent = item.title;
  container.appendChild(title);

  if (item.startTime || item.endTime) {
    const timeMeta = document.createElement('span');
    timeMeta.className = 'event-meta';

    let label = '';
    if (item.startTime && item.endTime) {
      label = `${formatTime(item.startTime)} – ${formatTime(item.endTime)}`;
    } else if (item.startTime) {
      label = formatTime(item.startTime);
    } else if (item.endTime) {
      label = `Until ${formatTime(item.endTime)}`;
    }

    timeMeta.textContent = label ? `⏰ ${label}` : '⏰ All day';
    container.appendChild(timeMeta);
  }

  if (item.location) {
    const meta = document.createElement('span');
    meta.className = 'event-meta';
    meta.textContent = `📍 ${item.location}`;
    container.appendChild(meta);
  }

  if (item.notes) {
    const notes = document.createElement('p');
    notes.className = 'event-notes';
    notes.textContent = item.notes;
    container.appendChild(notes);
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

  return events.filter((event) => {
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

  eventTagsContainer.innerHTML = '';

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

  filterTagsContainer.innerHTML = '';

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

  tagList.innerHTML = '';

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

function removeTag(tagId) {
  state.tags = state.tags.filter((tag) => tag.id !== tagId);
  state.filters.tags = state.filters.tags.filter((id) => id !== tagId);

  let eventsUpdated = false;
  state.events = state.events.map((event) => {
    if (!Array.isArray(event.tags)) {
      return event;
    }
    if (!event.tags.includes(tagId)) {
      return event;
    }
    eventsUpdated = true;
    return {
      ...event,
      tags: event.tags.filter((id) => id !== tagId),
    };
  });

  const tagsSaved = saveTags(state.tags);
  const eventsSaved = eventsUpdated ? saveEvents(state.events) : true;
  saveFilters(state.filters);
  renderTagOptions();
  renderFilterTags();
  renderTagList();
  rerenderViews();

  if (tagsSaved && eventsSaved) {
    showToast('Tag removed', 'info');
  }
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
    const currentEvents = getFilteredEvents([...state.events])
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
  const titleDate = new Date(isoDate);
  dayModalTitle.textContent = titleDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  dayModalList.innerHTML = '';

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
    dayModalList.innerHTML = '';
  }
  if (state.lastFocusedDayIso) {
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

function createId() {
  return `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function createDeleteButton(id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'item-remove';
  button.textContent = 'Delete';
  button.addEventListener('click', () => handleDeleteEvent(id));
  button.setAttribute('aria-label', 'Delete event');
  return button;
}

function createEditButton(id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'item-edit';
  button.textContent = 'Edit';
  button.addEventListener('click', () => startEditingEvent(id));
  button.setAttribute('aria-label', 'Edit event');
  return button;
}

function handleDeleteEvent(id) {
  const nextEvents = state.events.filter((item) => item.id !== id);
  if (nextEvents.length === state.events.length) {
    return;
  }

  state.events = nextEvents;
  if (state.editingId === id) {
    clearEditingState();
    resetFormFields();
  }
  const saved = saveEvents(state.events);
  rerenderViews();
  if (saved) {
    showToast('Event deleted', 'error');
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
  renderTagOptions([]);
  if (!keepDate) {
    setDefaultDate();
  }
  eventTitle.focus();
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  eventDate.value = today;
}

function showToast(message, variant = 'info') {
  if (!toast || !message) {
    return;
  }

  const safeVariant = ['success', 'error', 'info'].includes(variant) ? variant : 'info';
  toast.textContent = message;
  toast.className = `toast toast--${safeVariant}`;

  // Trigger a reflow so repeated toasts animate correctly.
  void toast.offsetWidth;

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

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
