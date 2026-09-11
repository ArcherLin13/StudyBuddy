var dateUtil = require('./date.js')

function streakScore(days) {
  if (days <= 0) return 0
  if (days <= 2) return 4
  if (days <= 4) return 8
  if (days <= 6) return 12
  return 15
}

function gradeLabel(score) {
  if (score >= 90) return '优秀'
  if (score >= 75) return '良好'
  if (score >= 60) return '合格'
  if (score >= 40) return '加油'
  return '需改进'
}

function secondsByDate(records) {
  var map = {}
  records.forEach(function (r) {
    map[r.date] = (map[r.date] || 0) + (r.seconds || 0)
  })
  return map
}

function checkedDateSet(records, checkinMinMinutes) {
  var byDate = secondsByDate(records)
  var threshold = (checkinMinMinutes || 15) * 60
  var set = {}
  Object.keys(byDate).forEach(function (date) {
    if (byDate[date] >= threshold) {
      set[date] = true
    }
  })
  return set
}

function streakAt(dateStr, checkedSet) {
  var streak = 0
  var cursor = dateStr
  while (checkedSet[cursor]) {
    streak += 1
    cursor = dateUtil.addDays(cursor, -1)
  }
  return streak
}

function computeWeek(weekId, records, weekMeta, subjects, settings) {
  var days = dateUtil.getWeekDays(weekId)
  var today = dateUtil.todayStr()
  var meta = weekMeta[weekId] || {
    targetMinutes: Math.max(
      1,
      (subjects || []).reduce(function (s, x) {
        return s + (Number(x.durationMin) || 0)
      }, 0) * ((settings && settings.planDaysPerWeek) || 5)
    ),
    checkinMinMinutes: (settings && settings.checkinMinMinutes) || 15
  }

  var weekRecords = records.filter(function (r) {
    return r.date >= days[0] && r.date <= days[6]
  })

  var dailyMap = {}
  var subjectMap = {}
  days.forEach(function (d) {
    dailyMap[d] = { date: d, seconds: 0, subjects: {} }
  })

  weekRecords.forEach(function (r) {
    var day = dailyMap[r.date]
    if (!day) return
    day.seconds += r.seconds || 0
    var name = r.subjectName || '未命名'
    day.subjects[name] = (day.subjects[name] || 0) + (r.seconds || 0)
    subjectMap[name] = (subjectMap[name] || 0) + (r.seconds || 0)
  })

  var totalSeconds = weekRecords.reduce(function (s, r) {
    return s + (r.seconds || 0)
  }, 0)
  var totalMinutes = totalSeconds / 60
  var targetMinutes = Math.max(1, meta.targetMinutes)
  var timeScore = Math.min(60, (totalMinutes / targetMinutes) * 60)

  var checkinMin = meta.checkinMinMinutes || 15
  var checkedDays = days.filter(function (d) {
    return (dailyMap[d].seconds || 0) >= checkinMin * 60
  })
  var stabilityScore = (checkedDays.length / 7) * 25

  var allChecked = checkedDateSet(records, checkinMin)
  var sunday = days[6]
  var streakDate = today > sunday ? sunday : today < days[0] ? sunday : today
  var streakDays = streakAt(streakDate, allChecked)
  var comboScore = streakScore(streakDays)

  var totalScore = Math.round(timeScore + stabilityScore + comboScore)

  var daily = days.map(function (d) {
    var row = dailyMap[d]
    var subjectList = Object.keys(row.subjects)
      .sort()
      .map(function (name) {
        return { name: name, seconds: row.subjects[name] }
      })
    return {
      date: d,
      weekday: dateUtil.weekdayLabel(d),
      seconds: row.seconds,
      durationText: dateUtil.formatDuration(row.seconds),
      subjects: subjectList
    }
  })

  var subjectsOut = Object.keys(subjectMap)
    .sort()
    .map(function (name) {
      return {
        name: name,
        seconds: subjectMap[name],
        durationText: dateUtil.formatDuration(subjectMap[name])
      }
    })

  return {
    weekId: weekId,
    rangeText: dateUtil.formatWeekRange(weekId),
    isCurrent: weekId === dateUtil.getWeekId(today),
    totalSeconds: totalSeconds,
    durationText: dateUtil.formatDuration(totalSeconds),
    targetMinutes: targetMinutes,
    timeScore: Math.round(timeScore * 10) / 10,
    stabilityScore: Math.round(stabilityScore * 10) / 10,
    comboScore: comboScore,
    streakDays: streakDays,
    checkedDays: checkedDays.length,
    score: totalScore,
    grade: gradeLabel(totalScore),
    daily: daily,
    subjects: subjectsOut
  }
}

function listWeekIds(records) {
  var thisWeek = dateUtil.getWeekId(dateUtil.todayStr())
  var oldest = thisWeek
  records.forEach(function (r) {
    var id = dateUtil.getWeekId(r.date)
    if (id < oldest) oldest = id
  })
  var weeks = []
  var id = thisWeek
  while (id >= oldest) {
    weeks.push(id)
    id = dateUtil.addDays(id, -7)
    if (weeks.length > 104) break
  }
  return weeks
}

function listWeekReports(records, weekMeta, subjects, settings) {
  return listWeekIds(records).map(function (weekId) {
    return computeWeek(weekId, records, weekMeta, subjects, settings)
  })
}

function todaySeconds(records) {
  var today = dateUtil.todayStr()
  return records.reduce(function (s, r) {
    return r.date === today ? s + (r.seconds || 0) : s
  }, 0)
}

module.exports = {
  streakScore: streakScore,
  gradeLabel: gradeLabel,
  secondsByDate: secondsByDate,
  checkedDateSet: checkedDateSet,
  streakAt: streakAt,
  computeWeek: computeWeek,
  listWeekIds: listWeekIds,
  listWeekReports: listWeekReports,
  todaySeconds: todaySeconds
}
