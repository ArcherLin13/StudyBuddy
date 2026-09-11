var dateUtil = require('./date.js')

var KEYS = {
  subjects: 'subjects',
  settings: 'settings',
  records: 'records',
  weekMeta: 'weekMeta',
  session: 'session'
}

var DEFAULT_SUBJECTS = [
  { id: 'sub_a', name: '科目A', durationMin: 25, order: 0 },
  { id: 'sub_b', name: '科目B', durationMin: 25, order: 1 }
]

var DEFAULT_SETTINGS = {
  planDaysPerWeek: 5,
  checkinMinMinutes: 15,
  soundOn: true
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function sortSubjects(list) {
  return list.slice().sort(function (a, b) {
    return a.order - b.order
  })
}

function getSubjects() {
  var list = wx.getStorageSync(KEYS.subjects)
  if (!list || !list.length) {
    list = clone(DEFAULT_SUBJECTS)
    wx.setStorageSync(KEYS.subjects, list)
  }
  return sortSubjects(list)
}

function setSubjects(list) {
  var next = list.map(function (item, index) {
    return {
      id: item.id,
      name: item.name,
      durationMin: item.durationMin,
      order: index
    }
  })
  wx.setStorageSync(KEYS.subjects, next)
  return next
}

function getSettings() {
  var settings = wx.getStorageSync(KEYS.settings)
  if (!settings) {
    settings = clone(DEFAULT_SETTINGS)
    wx.setStorageSync(KEYS.settings, settings)
  }
  return Object.assign({}, DEFAULT_SETTINGS, settings)
}

function setSettings(settings) {
  var next = Object.assign({}, getSettings(), settings)
  wx.setStorageSync(KEYS.settings, next)
  return next
}

function getRecords() {
  return wx.getStorageSync(KEYS.records) || []
}

function setRecords(records) {
  wx.setStorageSync(KEYS.records, records)
}

function getWeekMeta() {
  return wx.getStorageSync(KEYS.weekMeta) || {}
}

function setWeekMeta(meta) {
  wx.setStorageSync(KEYS.weekMeta, meta)
}

function targetMinutesFromConfig(subjects, settings) {
  var sum = 0
  var i
  for (i = 0; i < subjects.length; i++) {
    sum += Number(subjects[i].durationMin) || 0
  }
  return Math.max(1, sum * (Number(settings.planDaysPerWeek) || 1))
}

function ensureWeekMeta(dateStr) {
  var weekId = dateUtil.getWeekId(dateStr)
  var meta = getWeekMeta()
  if (!meta[weekId]) {
    meta[weekId] = {
      targetMinutes: targetMinutesFromConfig(getSubjects(), getSettings()),
      checkinMinMinutes: getSettings().checkinMinMinutes
    }
    setWeekMeta(meta)
  }
  return meta[weekId]
}

function addRecord(record) {
  var records = getRecords()
  records.push(record)
  setRecords(records)
  ensureWeekMeta(record.date)
  return records
}

function getSession() {
  return wx.getStorageSync(KEYS.session) || null
}

function setSession(session) {
  if (!session) {
    wx.removeStorageSync(KEYS.session)
    return null
  }
  wx.setStorageSync(KEYS.session, session)
  return session
}

function makeId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
}

module.exports = {
  KEYS: KEYS,
  DEFAULT_SUBJECTS: DEFAULT_SUBJECTS,
  DEFAULT_SETTINGS: DEFAULT_SETTINGS,
  getSubjects: getSubjects,
  setSubjects: setSubjects,
  getSettings: getSettings,
  setSettings: setSettings,
  getRecords: getRecords,
  setRecords: setRecords,
  getWeekMeta: getWeekMeta,
  setWeekMeta: setWeekMeta,
  targetMinutesFromConfig: targetMinutesFromConfig,
  ensureWeekMeta: ensureWeekMeta,
  addRecord: addRecord,
  getSession: getSession,
  setSession: setSession,
  makeId: makeId
}
