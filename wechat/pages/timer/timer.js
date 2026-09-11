var storage = require('../../utils/storage.js')
var dateUtil = require('../../utils/date.js')
var money = require('../../utils/money.js')

function remainingMs(current, now) {
  var elapsed = current.elapsedMsBeforePause || 0
  if (current.status === 'running' && current.startedAt) {
    elapsed += now - current.startedAt
  }
  return Math.max(0, current.durationSec * 1000 - elapsed)
}

function elapsedMs(current, now) {
  return current.durationSec * 1000 - remainingMs(current, now)
}

Page({
  data: {
    subjectName: '',
    timeText: '00:00',
    hint: '',
    btnMode: 'play',
    showEnd: false,
    running: false,
    todayYuanText: '',
    todayMoneyHint: ''
  },

  onLoad: function () {
    this.alarm = wx.createInnerAudioContext()
    this.alarm.src = '/assets/alarm.wav'
    this.alarm.obeyMuteSwitch = false
    this.tickTimer = null
    this.recoverSession()
    this.syncView()
  },

  onShow: function () {
    if (!this.tickTimer) {
      this.recoverSession()
    }
    this.syncView()
  },

  onHide: function () {
    this.pauseInternal('hide')
    this.setKeepScreen(false)
  },

  onUnload: function () {
    this.clearTick()
    this.setKeepScreen(false)
    if (this.alarm) {
      this.alarm.stop()
      this.alarm.destroy()
      this.alarm = null
    }
  },

  recoverSession: function () {
    var session = storage.getSession()
    if (!session || !session.current || session.current.status !== 'running') {
      this.session = session
      this.clearTick()
      return
    }
    var now = Date.now()
    var gap = session.current.startedAt ? now - session.current.startedAt : 0
    if (gap > 3000) {
      session.current.status = 'paused'
      session.current.startedAt = null
    } else {
      var left = remainingMs(session.current, now)
      if (left <= 0) {
        this.session = session
        this.completeCurrent()
        return
      }
      session.current.elapsedMsBeforePause = elapsedMs(session.current, now)
      session.current.status = 'paused'
      session.current.startedAt = null
    }
    storage.setSession(session)
    this.session = session
    this.clearTick()
  },

  persist: function () {
    storage.setSession(this.session)
  },

  getSubjects: function () {
    return storage.getSubjects()
  },

  nextSubject: function (session) {
    var subjects = this.getSubjects()
    if (!subjects.length) return null
    var index = session && typeof session.nextIndex === 'number' ? session.nextIndex : 0
    index = ((index % subjects.length) + subjects.length) % subjects.length
    return { subject: subjects[index], index: index }
  },

  startTick: function () {
    var that = this
    this.clearTick()
    this.tickTimer = setInterval(function () {
      that.onTick()
    }, 200)
  },

  clearTick: function () {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  },

  onTick: function () {
    var session = this.session
    if (!session || !session.current || session.current.status !== 'running') {
      this.clearTick()
      return
    }
    var now = Date.now()
    if (remainingMs(session.current, now) <= 0) {
      this.completeCurrent()
      return
    }
    if (!this._lastHeartbeat || now - this._lastHeartbeat > 1000) {
      session.current.elapsedMsBeforePause = elapsedMs(session.current, now)
      session.current.startedAt = now
      this.persist()
      this._lastHeartbeat = now
    }
    this.syncView()
  },

  onMainTap: function () {
    var session = this.session
    if (session && session.current && session.current.status === 'running') {
      this.pauseInternal('user')
      this.syncView()
      return
    }
    this.startOrResume()
  },

  startOrResume: function () {
    if (this.alarm) {
      try { this.alarm.stop() } catch (e) {}
    }
    var subjects = this.getSubjects()
    if (!subjects.length) {
      wx.showToast({ title: '请先添加科目', icon: 'none' })
      return
    }
    var session = this.session
    if (session && session.current && session.current.status === 'paused') {
      session.current.status = 'running'
      session.current.startedAt = Date.now()
      this.session = session
      this.persist()
      this.setKeepScreen(true)
      this.startTick()
      this.syncView()
      return
    }

    if (!session) {
      session = { active: true, nextIndex: 0, current: null }
    }
    var next = this.nextSubject(session)
    var subject = next.subject
    session.active = true
    session.nextIndex = next.index
    session.current = {
      subjectId: subject.id,
      subjectName: subject.name,
      durationSec: Math.max(1, Number(subject.durationMin) || 1) * 60,
      startTs: Date.now(),
      elapsedMsBeforePause: 0,
      startedAt: Date.now(),
      status: 'running'
    }
    this.session = session
    this.persist()
    this.setKeepScreen(true)
    this.startTick()
    this.syncView()
  },

  pauseInternal: function (reason) {
    var session = this.session
    if (!session || !session.current || session.current.status !== 'running') {
      return
    }
    var now = Date.now()
    session.current.elapsedMsBeforePause = elapsedMs(session.current, now)
    session.current.startedAt = null
    session.current.status = 'paused'
    this.session = session
    this.persist()
    this.clearTick()
    this.setKeepScreen(false)
    if (reason === 'hide') {
      this.syncView()
    }
  },

  completeCurrent: function () {
    var session = this.session
    if (!session || !session.current) return
    var current = session.current
    this.commitRecord(current, current.durationSec)
    var subjects = this.getSubjects()
    var len = Math.max(1, subjects.length)
    session.nextIndex = (session.nextIndex + 1) % len
    session.current = null
    session.active = true
    this.session = session
    this.persist()
    this.clearTick()
    this.setKeepScreen(false)
    this.playAlarm()
    this.syncView()
  },

  onEndTap: function () {
    var that = this
    wx.showModal({
      title: '结束本轮',
      content: '结束学习并回到第一科？已学时长会保留。',
      success: function (res) {
        if (res.confirm) that.endSession()
      }
    })
  },

  endSession: function () {
    var session = this.session
    if (!session) return
    if (session.current) {
      var now = Date.now()
      var seconds = Math.floor(elapsedMs(session.current, now) / 1000)
      this.commitRecord(session.current, seconds)
    }
    this.session = null
    this.persist()
    this.clearTick()
    this.setKeepScreen(false)
    if (this.alarm) this.alarm.stop()
    this.syncView()
  },

  commitRecord: function (current, seconds) {
    if (!current || seconds < 1) return
    storage.addRecord({
      date: dateUtil.todayStr(),
      subjectId: current.subjectId,
      subjectName: current.subjectName,
      seconds: seconds,
      startTs: current.startTs || Date.now(),
      endTs: Date.now()
    })
  },

  playAlarm: function () {
    wx.vibrateLong()
    var settings = storage.getSettings()
    if (!settings.soundOn || !this.alarm) return
    try {
      this.alarm.stop()
      this.alarm.src = '/assets/alarm.wav'
      this.alarm.play()
    } catch (e) {}
  },

  setKeepScreen: function (on) {
    wx.setKeepScreenOn({ keepScreenOn: !!on })
  },

  syncView: function () {
    var session = this.session
    var now = Date.now()
    var subjectName = ''
    var timeText = '00:00'
    var hint = ''
    var btnMode = 'play'
    var running = false
    var showEnd = !!(session && session.active)

    if (session && session.current) {
      subjectName = session.current.subjectName
      timeText = dateUtil.formatMmSs(remainingMs(session.current, now))
      running = session.current.status === 'running'
      btnMode = running ? 'pause' : 'resume'
      hint = running ? '学习中' : '已暂停'
    } else {
      var next = this.nextSubject(session || { nextIndex: 0 })
      if (next) {
        subjectName = next.subject.name
        timeText = dateUtil.formatMmSs(next.subject.durationMin * 60 * 1000)
        hint = session && session.active ? '下一科' : '准备开始'
      } else {
        subjectName = '请添加科目'
        hint = '去配置页添加'
        timeText = '00:00'
      }
    }

    var settings = storage.getSettings()
    var records = storage.getRecords()
    var live = 0
    if (session && session.current) {
      live = Math.floor(elapsedMs(session.current, now) / 1000)
    }
    if (live > 0) {
      records = records.concat([{
        date: dateUtil.todayStr(),
        subjectId: '_live',
        subjectName: '',
        seconds: live,
        startTs: 0,
        endTs: 0
      }])
    }
    var reward = money.todayReward(records, settings)
    var todayYuanText = money.formatYuan(reward.earnedYuan)
    var todayMoneyHint = ''
    if (reward.earnedYuan <= 0) {
      todayMoneyHint = '满 15 分钟才开始计钱'
    } else if (reward.streakDays >= 2) {
      todayMoneyHint = '连击 ' + reward.streakDays + ' 天 ' + money.formatStreakMultiplier(reward.streakMultiplier)
    } else {
      todayMoneyHint = '1小时¥10 · 再学更划算'
    }

    this.setData({
      subjectName: subjectName,
      timeText: timeText,
      hint: hint,
      btnMode: btnMode,
      showEnd: showEnd,
      running: running,
      todayYuanText: todayYuanText,
      todayMoneyHint: todayMoneyHint
    })
  }
})
