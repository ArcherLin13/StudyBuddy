var dateUtil = require('./date.js')

var MONEY_HOUR_YUAN = 10
var MAX_MONEY_HOURS = 8

function meetsMoneyMinimum(seconds, minMinutes) {
  return seconds >= Math.max(0, minMinutes) * 60
}

function moneyFromDuration(seconds, dailyCap, minMinutes) {
  if (minMinutes > 0 && !meetsMoneyMinimum(seconds, minMinutes)) return 0
  var hours = Math.min(Math.max(0, seconds) / 3600, MAX_MONEY_HOURS)
  var scale = Math.max(0, dailyCap == null ? MONEY_HOUR_YUAN : dailyCap) / MONEY_HOUR_YUAN
  return Math.round(5 * hours * (hours + 1) * scale * 10) / 10
}

function hardMoneyCap(dailyCap) {
  var top = moneyFromDuration(MAX_MONEY_HOURS * 3600, dailyCap, 0)
  return Math.round(top * 1.5 * 10) / 10
}

function applyStreakToMoney(baseYuan, multiplier, dailyCap) {
  if (baseYuan <= 0) return 0
  var earned = Math.round(Math.max(0, baseYuan) * Math.max(1, multiplier) * 10) / 10
  return Math.min(hardMoneyCap(dailyCap), earned)
}

function streakMultiplier(streakDays) {
  var n = Math.max(0, Math.floor(streakDays))
  if (n >= 14) return 1.5
  if (n >= 7) return 1.3
  if (n >= 4) return 1.2
  if (n >= 2) return 1.1
  return 1
}

function formatYuan(amount) {
  var n = Math.max(0, amount)
  return n === Math.floor(n) ? '¥' + n : '¥' + n.toFixed(1)
}

function formatStreakMultiplier(mult) {
  if (mult <= 1) return '×1'
  return '×' + String(mult.toFixed(1)).replace(/\.0$/, '')
}

function secondsByDate(records) {
  var map = {}
  records.forEach(function (r) {
    map[r.date] = (map[r.date] || 0) + (r.seconds || 0)
  })
  return map
}

function streakAtDate(dateStr, byDate, minMinutes) {
  var streak = 0
  var cursor = dateStr
  while (meetsMoneyMinimum(byDate[cursor] || 0, minMinutes)) {
    streak += 1
    cursor = dateUtil.addDays(cursor, -1)
  }
  return streak
}

function rewardForDay(date, records, settings) {
  var byDate = secondsByDate(records)
  var seconds = byDate[date] || 0
  var cap = (settings && settings.dailyMoneyCap) || MONEY_HOUR_YUAN
  var minMinutes = (settings && settings.moneyMinMinutes) || 15
  var baseYuan = moneyFromDuration(seconds, cap, minMinutes)
  var streakDays = streakAtDate(date, byDate, minMinutes)
  var mult = streakMultiplier(streakDays)
  return {
    date: date,
    seconds: seconds,
    baseYuan: baseYuan,
    streakDays: streakDays,
    streakMultiplier: mult,
    earnedYuan: applyStreakToMoney(baseYuan, mult, cap)
  }
}

function todayReward(records, settings) {
  return rewardForDay(dateUtil.todayStr(), records, settings)
}

function sumYuan(rewards, pred) {
  var total = 0
  rewards.forEach(function (r) {
    if (!pred || pred(r)) total += r.earnedYuan || 0
  })
  return Math.round(total * 10) / 10
}

function weekYuan(rewards, dates) {
  var set = {}
  dates.forEach(function (d) {
    set[d] = true
  })
  return sumYuan(rewards, function (r) {
    return set[r.date]
  })
}

function monthYuan(rewards, monthId) {
  return sumYuan(rewards, function (r) {
    return r.date.slice(0, 7) === monthId
  })
}

function allDayRewards(records, settings) {
  return Object.keys(secondsByDate(records))
    .sort()
    .map(function (date) {
      return rewardForDay(date, records, settings)
    })
}

module.exports = {
  MONEY_HOUR_YUAN: MONEY_HOUR_YUAN,
  meetsMoneyMinimum: meetsMoneyMinimum,
  moneyFromDuration: moneyFromDuration,
  applyStreakToMoney: applyStreakToMoney,
  streakMultiplier: streakMultiplier,
  formatYuan: formatYuan,
  formatStreakMultiplier: formatStreakMultiplier,
  rewardForDay: rewardForDay,
  todayReward: todayReward,
  allDayRewards: allDayRewards,
  weekYuan: weekYuan,
  monthYuan: monthYuan
}
