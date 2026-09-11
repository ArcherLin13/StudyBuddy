var storage = require('../../utils/storage.js')
var score = require('../../utils/score.js')
var sync = require('../../utils/sync.js')

Page({
  data: {
    weeks: [],
    expandedWeekId: '',
    editVisible: false,
    editDate: '',
    editName: '',
    editMinutes: ''
  },

  reload: function () {
    var reports = score.listWeekReports(
      storage.getRecords(),
      storage.getWeekMeta(),
      storage.getSubjects(),
      storage.getSettings()
    )
    var expanded = this.data.expandedWeekId || (reports[0] && reports[0].weekId) || ''
    this.setData({
      weeks: reports.map(function (w) {
        return Object.assign({}, w, { expanded: w.weekId === expanded })
      }),
      expandedWeekId: expanded
    })
  },

  onShow: function () {
    this.reload()
  },

  onToggle: function (e) {
    var id = e.currentTarget.dataset.id
    var next = this.data.expandedWeekId === id ? '' : id
    this.setData({
      expandedWeekId: next,
      weeks: this.data.weeks.map(function (w) {
        return Object.assign({}, w, { expanded: w.weekId === next })
      })
    })
  },

  onDeleteDay: function (e) {
    var date = e.currentTarget.dataset.date
    var label = e.currentTarget.dataset.label
    var that = this
    wx.showModal({
      title: '删除当天',
      content: '删除 ' + label + ' 的全部学习记录？周分和奖励会重算。',
      success: function (res) {
        if (!res.confirm) return
        var prev = storage.getRecords()
        var next = storage.deleteDayRecords(date)
        var removed = prev.filter(function (r) {
          return r.date === date
        })
        sync.persistRecordChange(next, removed)
        that.reload()
      }
    })
  },

  onDeleteSubject: function (e) {
    var date = e.currentTarget.dataset.date
    var name = e.currentTarget.dataset.name
    var label = e.currentTarget.dataset.label
    var that = this
    wx.showModal({
      title: '删除科目记录',
      content: '删除 ' + label + '「' + name + '」的记录？',
      success: function (res) {
        if (!res.confirm) return
        var prev = storage.getRecords()
        var next = storage.deleteDaySubjectRecords(date, name)
        var removed = prev.filter(function (r) {
          return r.date === date && (r.subjectName || '未命名') === name
        })
        sync.persistRecordChange(next, removed)
        that.reload()
      }
    })
  },

  onEditSubject: function (e) {
    this.setData({
      editVisible: true,
      editDate: e.currentTarget.dataset.date,
      editName: e.currentTarget.dataset.name,
      editMinutes: String(e.currentTarget.dataset.minutes || 1)
    })
  },

  onEditInput: function (e) {
    this.setData({ editMinutes: e.detail.value })
  },

  onEditCancel: function () {
    this.setData({ editVisible: false })
  },

  noop: function () {},

  onEditSave: function () {
    var minutes = Number(this.data.editMinutes)
    if (isNaN(minutes) || minutes < 0) {
      wx.showToast({ title: '请输入有效分钟数', icon: 'none' })
      return
    }
    var prev = storage.getRecords()
    var next = storage.setDaySubjectMinutes(
      this.data.editDate,
      this.data.editName,
      Math.min(600, Math.round(minutes))
    )
    var nextIds = {}
    next.forEach(function (r) {
      if (r.id) nextIds[r.id] = true
    })
    var removed = prev.filter(function (r) {
      return r.id && !nextIds[r.id]
    })
    sync.persistRecordChange(next, removed)
    this.setData({ editVisible: false })
    this.reload()
  }
})
