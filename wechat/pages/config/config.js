var storage = require('../../utils/storage.js')

function clamp(n, min, max) {
  n = Number(n)
  if (isNaN(n)) return min
  if (n < min) return min
  if (n > max) return max
  return n
}

Page({
  data: {
    subjects: [],
    planDaysPerWeek: 5,
    checkinMinMinutes: 15,
    soundOn: true
  },

  onShow: function () {
    this.reload()
  },

  reload: function () {
    var settings = storage.getSettings()
    this.setData({
      subjects: storage.getSubjects(),
      planDaysPerWeek: settings.planDaysPerWeek,
      checkinMinMinutes: settings.checkinMinMinutes,
      soundOn: settings.soundOn
    })
  },

  saveSubjects: function (list) {
    this.setData({ subjects: storage.setSubjects(list) })
  },

  onNameInput: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subjects
    list[index].name = e.detail.value
    storage.setSubjects(list)
  },

  onNameBlur: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subjects.slice()
    var name = (e.detail.value || '').trim()
    if (!name) name = '未命名科目'
    list[index].name = name
    this.saveSubjects(list)
  },

  onDurationInput: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subjects.slice()
    list[index].durationMin = clamp(e.detail.value, 1, 180)
    this.saveSubjects(list)
  },

  onMinus: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subjects.slice()
    list[index].durationMin = clamp((list[index].durationMin || 1) - 1, 1, 180)
    this.saveSubjects(list)
  },

  onPlus: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subjects.slice()
    list[index].durationMin = clamp((list[index].durationMin || 1) + 1, 1, 180)
    this.saveSubjects(list)
  },

  onMoveUp: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    if (index <= 0) return
    var list = this.data.subjects.slice()
    var tmp = list[index - 1]
    list[index - 1] = list[index]
    list[index] = tmp
    this.saveSubjects(list)
  },

  onMoveDown: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subjects.slice()
    if (index >= list.length - 1) return
    var tmp = list[index + 1]
    list[index + 1] = list[index]
    list[index] = tmp
    this.saveSubjects(list)
  },

  onDelete: function (e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subjects.slice()
    if (list.length <= 1) {
      wx.showToast({ title: '至少保留一个科目', icon: 'none' })
      return
    }
    var that = this
    wx.showModal({
      title: '删除科目',
      content: '删除「' + list[index].name + '」？历史记录仍会保留。',
      success: function (res) {
        if (!res.confirm) return
        list.splice(index, 1)
        that.saveSubjects(list)
      }
    })
  },

  onAdd: function () {
    var list = this.data.subjects.slice()
    var letter = String.fromCharCode(65 + (list.length % 26))
    list.push({
      id: storage.makeId('sub'),
      name: '科目' + letter,
      durationMin: 25,
      order: list.length
    })
    this.saveSubjects(list)
  },

  onPlanDays: function (e) {
    var value = clamp(e.detail.value, 1, 7)
    this.setData({ planDaysPerWeek: value })
    storage.setSettings({ planDaysPerWeek: value })
  },

  onCheckin: function (e) {
    var value = clamp(e.detail.value, 1, 180)
    this.setData({ checkinMinMinutes: value })
    storage.setSettings({ checkinMinMinutes: value })
  },

  onSound: function (e) {
    var value = !!e.detail.value
    this.setData({ soundOn: value })
    storage.setSettings({ soundOn: value })
  }
})
