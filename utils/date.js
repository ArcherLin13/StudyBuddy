function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function formatDate(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

function todayStr() {
  return formatDate(new Date())
}

function parseDate(str) {
  var parts = str.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

function addDays(dateStr, n) {
  var d = parseDate(dateStr)
  d.setDate(d.getDate() + n)
  return formatDate(d)
}

function getWeekStart(date) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  var day = d.getDay()
  var diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d
}

function getWeekId(dateOrStr) {
  var date = typeof dateOrStr === 'string' ? parseDate(dateOrStr) : dateOrStr
  return formatDate(getWeekStart(date))
}

function getWeekDays(weekId) {
  var days = []
  var i
  for (i = 0; i < 7; i++) {
    days.push(addDays(weekId, i))
  }
  return days
}

function weekdayLabel(dateStr) {
  var labels = ['日', '一', '二', '三', '四', '五', '六']
  return labels[parseDate(dateStr).getDay()]
}

function formatWeekRange(weekId) {
  var end = addDays(weekId, 6)
  var a = weekId.split('-')
  var b = end.split('-')
  return a[1] + '.' + a[2] + ' – ' + b[1] + '.' + b[2]
}

function formatMmSs(ms) {
  var total = Math.max(0, Math.ceil(ms / 1000))
  var m = Math.floor(total / 60)
  var s = total % 60
  return pad(m) + ':' + pad(s)
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0 分钟'
  var mins = Math.round(seconds / 60)
  if (mins < 1) return '不到 1 分钟'
  if (mins < 60) {
    return mins + ' 分钟'
  }
  var h = Math.floor(mins / 60)
  var m = mins % 60
  if (m === 0) {
    return h + ' 小时'
  }
  return h + ' 小时 ' + m + ' 分钟'
}

module.exports = {
  pad: pad,
  formatDate: formatDate,
  todayStr: todayStr,
  parseDate: parseDate,
  addDays: addDays,
  getWeekStart: getWeekStart,
  getWeekId: getWeekId,
  getWeekDays: getWeekDays,
  weekdayLabel: weekdayLabel,
  formatWeekRange: formatWeekRange,
  formatMmSs: formatMmSs,
  formatDuration: formatDuration
}
