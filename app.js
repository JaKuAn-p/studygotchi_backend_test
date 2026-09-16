const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const shortDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const colors = { reading: 'event-reading', review: 'event-review', exam: 'event-exam' };
const today = new Date();
let weekStart = new Date(today);
weekStart.setDate(weekStart.getDate() - weekStart.getDay());
let events = JSON.parse(localStorage.getItem('studygotchi-events-v2')) || [];
let editingId = null;
const plannerToday = new Date(today);
let reminderEvent = null;
let timerInterval = null;
let timerRemaining = 0;
let timerCompleted = false;
let pet = JSON.parse(localStorage.getItem('studygotchi-pet')) || { alive: true, sessions: 0, level: 1 };

const $ = (selector) => document.querySelector(selector);
const timeToMinutes = (time) => { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };
const formatTime = (time) => time.replace(':00', '.00').replace(':30', '.30');
const saveEvents = () => localStorage.setItem('studygotchi-events-v2', JSON.stringify(events));
const savePet = () => localStorage.setItem('studygotchi-pet', JSON.stringify(pet));
function getTimePickerValue(name) { return $(`#plannerForm input[name="${name}"]`).value.trim(); }
function isValidTime(time) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time); }

$('#loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const usernameInput = $('#loginForm input[name="username"]');
  const passwordInput = $('#loginForm input[name="password"]');
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !password) {
    $('#loginError').hidden = false;
    return;
  }
  $('#loginError').hidden = true;
  $('#signedInUser').textContent = username;
  $('#userAvatar').textContent = username.charAt(0).toUpperCase();
  $('#loginBackdrop').classList.add('is-hidden');
});
$('#userAvatar').addEventListener('click', () => {
  $('#loginForm').reset();
  $('#loginBackdrop').hidden = false;
  $('#loginBackdrop').classList.remove('is-hidden');
  $('#loginForm input[name="username"]').focus();
});

function renderPet() {
  $('#petLevel').textContent = `LV. ${pet.level}`;
  $('#petSessions').textContent = `${pet.sessions} วัน`;
  $('#petHearts').textContent = pet.alive ? '♥♥♥' : '♡♡♡';
  $('#petStatus').textContent = pet.alive ? (pet.sessions ? 'แข็งแรงขึ้นจากการอ่าน' : 'พร้อมโตไปกับคุณ') : 'หมดแรงเพราะหยุดอ่านก่อนเวลา';
  $('#pixelPet').classList.toggle('dead', !pet.alive);
  $('#petZ').hidden = pet.alive;
  $('#revivePet').hidden = pet.alive;
}

function completePetSession() {
  if (timerCompleted || !reminderEvent) return;
  timerCompleted = true;
  pet.alive = true;
  pet.sessions += 1;
  pet.level = Math.floor(pet.sessions / 3) + 1;
  savePet();
  renderPet();
}

function killPet() {
  if (timerCompleted || !reminderEvent) return;
  pet.alive = false;
  savePet();
  renderPet();
}

function renderMiniCalendar() {
  const first = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const totalDays = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0).getDate();
  let html = `<div class="mini-head"><strong>${monthNames[weekStart.getMonth()]} ${weekStart.getFullYear() + 543}</strong><span class="mini-nav"><button class="mini-nav-button" id="miniPrev" aria-label="เดือนก่อน">‹</button><button class="mini-nav-button" id="miniNext" aria-label="เดือนถัดไป">›</button></span></div><div class="mini-week">${shortDays.map((day) => `<span>${day}</span>`).join('')}</div><div class="mini-dates">`;
  for (let i = 0; i < first.getDay(); i += 1) html += '<span class="muted">·</span>';
  for (let day = 1; day <= totalDays; day += 1) {
    const selected = day === today.getDate() && weekStart.getMonth() === today.getMonth() ? 'selected' : '';
    html += `<span class="${selected}">${day}</span>`;
  }
  $('#miniCalendar').innerHTML = `${html}</div>`;
  $('#miniPrev').addEventListener('click', () => { weekStart.setMonth(weekStart.getMonth() - 1); renderCalendar(); });
  $('#miniNext').addEventListener('click', () => { weekStart.setMonth(weekStart.getMonth() + 1); renderCalendar(); });
}

function renderCalendar() {
  const dates = Array.from({ length: 7 }, (_, index) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index));
  $('#monthTitle').textContent = `${monthNames[weekStart.getMonth()]} ${weekStart.getFullYear() + 543}`;
  $('#weekHeader').innerHTML = '<div class="timezone">GMT+7</div>' + dates.map((date) => {
    const isToday = date.toDateString() === today.toDateString();
    return `<div class="day-header ${isToday ? 'today' : ''}"><span>${dayNames[date.getDay()]}</span><strong>${date.getDate()}</strong></div>`;
  }).join('');
  $('#timeColumn').innerHTML = Array.from({ length: 12 }, (_, index) => `<div class="time-label">${String(index + 7).padStart(2, '0')}:00</div>`).join('');
  $('#weekGrid').innerHTML = '';
  events.forEach((event) => {
    const top = (timeToMinutes(event.start) - 420) / 60 * 60;
    const height = Math.max((timeToMinutes(event.end) - timeToMinutes(event.start)) / 60 * 60, 38);
    const element = document.createElement('article');
    element.className = `event ${colors[event.type] || colors.reading}`;
    element.dataset.type = event.type;
    const eventDate = event.date ? new Date(`${event.date}T00:00:00`) : new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + event.day);
    const dayOffset = Math.round((eventDate - weekStart) / 86400000);
    element.style.cssText = `left:calc(${dayOffset} * 14.2857% + 5px);top:${top}px;width:calc(14.2857% - 10px);height:${height}px`;
    element.innerHTML = `<div class="event-title">${event.title}</div><div class="event-time">${formatTime(event.start)} - ${formatTime(event.end)}</div>`;
    element.addEventListener('click', () => openModal(event));
    $('#weekGrid').appendChild(element);
  });
  renderMiniCalendar();
}

function openModal(event = null) {
  editingId = event?.id || null;
  $('#modalTitle').textContent = event ? 'แก้ไขตาราง' : 'วางแผนการอ่าน';
  $('#deleteEvent').hidden = !event;
  $('#eventForm').title.value = event?.title || '';
  $('#eventForm').day.value = event?.day ?? 1;
  $('#eventForm').type.value = event?.type || 'reading';
  $('#eventForm').start.value = event?.start || '09:00';
  $('#eventForm').end.value = event?.end || '10:00';
  $('#eventForm').description.value = event?.description || '';
  $('#modalBackdrop').hidden = false;
  $('#eventForm').title.focus();
}
function closeModal() { $('#modalBackdrop').hidden = true; }
function closePlanner() { $('#plannerBackdrop').hidden = true; }

function eventDateForToday(event) {
  if (event.date) return new Date(`${event.date}T${event.start}:00`);
  const date = new Date(today);
  date.setDate(date.getDate() + (Number(event.day) - 1 - date.getDay() + 7) % 7);
  return new Date(`${date.toISOString().slice(0, 10)}T${event.start}:00`);
}

function reminderKey(event, date = new Date()) { return `${event.id}-${date.toISOString().slice(0, 10)}`; }

function showReminder(event) {
  reminderEvent = event;
  $('#reminderTitle').textContent = event.title;
  $('#reminderDescription').textContent = event.description || `${formatTime(event.start)} - ${formatTime(event.end)}`;
  $('#reminderBackdrop').hidden = false;
}

function startReading() {
  if (!reminderEvent) return;
  timerRemaining = Math.max(timeToMinutes(reminderEvent.end) - timeToMinutes(reminderEvent.start), 1) * 60;
  timerCompleted = false;
  $('#timerTitle').textContent = reminderEvent.title;
  $('#reminderBackdrop').hidden = true;
  $('#timerBackdrop').hidden = false;
  const updateTimer = () => {
    const hours = Math.floor(timerRemaining / 3600);
    const minutes = Math.floor((timerRemaining % 3600) / 60);
    const seconds = timerRemaining % 60;
    $('#countdown').textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (timerRemaining <= 0) { clearInterval(timerInterval); completePetSession(); return; }
    timerRemaining -= 1;
  };
  clearInterval(timerInterval);
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function checkReminders() {
  if (reminderEvent || !$('#reminderBackdrop').hidden || !$('#timerBackdrop').hidden) return;
  const now = new Date();
  const event = events.find((item) => {
    const start = eventDateForToday(item);
    const end = new Date(`${start.toISOString().slice(0, 10)}T${item.end}:00`);
    const key = reminderKey(item, now);
    const snoozedUntil = Number(localStorage.getItem(`studygotchi-snooze-${key}`) || 0);
    return now >= start && now < end && now.getTime() >= snoozedUntil && !localStorage.getItem(`studygotchi-reminded-${key}`);
  });
  if (event) {
    localStorage.setItem(`studygotchi-reminded-${reminderKey(event, now)}`, '1');
    showReminder(event);
  }
}

function updatePlanPreview() {
  const form = $('#plannerForm');
  const days = Number(form.days.value) || 0;
  const start = getTimePickerValue('start');
  const end = getTimePickerValue('end');
  if (!isValidTime(start) || !isValidTime(end) || timeToMinutes(end) <= timeToMinutes(start)) {
    $('#planPreview').textContent = 'กรุณาพิมพ์เวลาเป็น HH:MM เช่น 19:00 และให้เวลาสิ้นสุดหลังเวลาเริ่มต้น';
    return;
  }
  const duration = timeToMinutes(end) - timeToMinutes(start);
  const hours = (duration / 60).toFixed(1).replace('.0', '');
  $('#planPreview').textContent = `ระบบจะสร้าง ${days} เซสชัน รวม ${hours * days} ชั่วโมง วันละ ${hours} ชั่วโมง เริ่มตั้งแต่วันนี้`;
}

$('#daySelect').innerHTML = dayNames.slice(1).map((name, index) => `<option value="${index + 1}">${name}</option>`).join('');
$('#createButton').addEventListener('click', () => { $('#plannerBackdrop').hidden = false; updatePlanPreview(); $('#plannerForm').subject.focus(); });
$('#closeModal').addEventListener('click', closeModal);
$('#cancelModal').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });
$('#closePlanner').addEventListener('click', closePlanner);
$('#cancelPlanner').addEventListener('click', closePlanner);
$('#plannerBackdrop').addEventListener('click', (event) => { if (event.target.id === 'plannerBackdrop') closePlanner(); });
$('#plannerForm').addEventListener('input', updatePlanPreview);
$('#plannerForm').addEventListener('change', updatePlanPreview);
$('#plannerForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.start = getTimePickerValue('start');
  data.end = getTimePickerValue('end');
  if (!isValidTime(data.start) || !isValidTime(data.end)) return;
  const duration = timeToMinutes(data.end) - timeToMinutes(data.start);
  const days = Number(data.days);
  if (duration <= 0 || days < 1 || days > 60) return;
  for (let index = 0; index < days; index += 1) {
    const date = new Date(plannerToday);
    date.setDate(date.getDate() + index);
    events.push({ id: Date.now() + index, title: `${data.subject} · วันที่ ${index + 1}`, date: date.toISOString().slice(0, 10), start: data.start, end: data.end, type: 'reading', description: `เซสชันที่ ${index + 1} จาก ${days}` });
  }
  saveEvents();
  weekStart = new Date(plannerToday);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  renderCalendar();
  closePlanner();
});
$('#eventForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  if (timeToMinutes(data.end) <= timeToMinutes(data.start)) return;
  if (editingId) events = events.map((item) => item.id === editingId ? { ...item, ...data } : item);
  else events.push({ ...data, id: Date.now() });
  saveEvents(); renderCalendar(); closeModal();
});
$('#deleteEvent').addEventListener('click', () => { events = events.filter((item) => item.id !== editingId); saveEvents(); renderCalendar(); closeModal(); });
$('#prevWeek').addEventListener('click', () => { weekStart.setDate(weekStart.getDate() - 7); renderCalendar(); });
$('#nextWeek').addEventListener('click', () => { weekStart.setDate(weekStart.getDate() + 7); renderCalendar(); });
$('#todayButton').addEventListener('click', () => { weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); renderCalendar(); });
$('#snoozeReminder').addEventListener('click', () => {
  if (!reminderEvent) return;
  const key = reminderKey(reminderEvent);
  localStorage.setItem(`studygotchi-snooze-${key}`, String(Date.now() + 5 * 60 * 1000));
  localStorage.removeItem(`studygotchi-reminded-${key}`);
  reminderEvent = null;
  $('#reminderBackdrop').hidden = true;
});
$('#startReading').addEventListener('click', startReading);
$('#finishReading').addEventListener('click', () => { killPet(); clearInterval(timerInterval); $('#timerBackdrop').hidden = true; reminderEvent = null; });
$('#revivePet').addEventListener('click', () => { pet = { alive: true, sessions: 0, level: 1 }; savePet(); renderPet(); });
renderCalendar();
renderPet();
checkReminders();
setInterval(checkReminders, 1000);