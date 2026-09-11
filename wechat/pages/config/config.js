var storage = require('../../utils/storage.js')
var firebase = require('../../utils/firebase.js')
var sync = require('../../utils/sync.js')

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
    soundOn: true,
    accountEmail: '',
    syncBusy: false,
    email: '',
    password: ''
  },

  onShow: function () {
    this.reload()
  },

  reload: function () {
    var settings = storage.getSettings()
    var auth = firebase.getAuth()
    this.setData({
      subjects: storage.getSubjects(),
      planDaysPerWeek: settings.planDaysPerWeek,
      checkinMinMinutes: settings.checkinMinMinutes,
      soundOn: settings.soundOn,
      accountEmail: (auth && auth.email) || ''
    })
  },

  afterChange: function () {
    sync.pushStudyData()
  },

  onEmail: function (e) {
    this.setData({ email: e.detail.value })
  },

  onPassword: function (e) {
    this.setData({ password: e.detail.value })
  },

  finishAuth: function (okTitle, okContent) {
    var that = this
    this.setData({ syncBusy: true })
    sync.syncStudyData()
      .then(function () {
        that.setData({ syncBusy: false, password: '' })
        that.reload()
        wx.showToast({ title: okTitle, icon: 'none' })
      })
      .catch(function (err) {
        that.setData({ syncBusy: false })
        that.reload()
        wx.showModal({
          title: okTitle,
          content: okContent + '。同步时：' + firebase.authErrorMessage(err && err.message),
          showCancel: false
        })
      })
  },

  onSignIn: function () {
    var email = (this.data.email || '').trim()
    var password = this.data.password || ''
    if (!email || password.length < 6) {
      wx.showToast({ title: '请填写邮箱和至少 6 位密码', icon: 'none' })
      return
    }
    var that = this
    this.setData({ syncBusy: true })
    firebase
      .signIn(email, password)
      .then(function () {
        that.finishAuth('登录成功', '已登录')
      })
      .catch(function (err) {
        that.setData({ syncBusy: false })
        wx.showModal({
          title: '登录失败',
          content: firebase.authErrorMessage(err && err.message),
          showCancel: false
        })
      })
  },

  onRegister: function () {
    var email = (this.data.email || '').trim()
    var password = this.data.password || ''
    if (!email || password.length < 6) {
      wx.showToast({ title: '请填写邮箱和至少 6 位密码', icon: 'none' })
      return
    }
    var that = this
    this.setData({ syncBusy: true })
    firebase
      .register(email, password)
      .then(function () {
        that.finishAuth('注册成功', '已登录')
      })
      .catch(function (err) {
        that.setData({ syncBusy: false })
        wx.showModal({
          title: '注册失败',
          content: firebase.authErrorMessage(err && err.message),
          showCancel: false
        })
      })
  },

  onSignOut: function () {
    var that = this
    wx.showModal({
      title: '退出登录',
      content: '本机记录会保留，但不再和云端同步。',
      success: function (res) {
        if (!res.confirm) return
        firebase.signOut()
        that.reload()
      }
    })
  },

  saveSubjects: function (list) {
    this.setData({ subjects: storage.setSubjects(list) })
    this.afterChange()
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
    this.afterChange()
  },

  onCheckin: function (e) {
    var value = clamp(e.detail.value, 1, 180)
    this.setData({ checkinMinMinutes: value })
    storage.setSettings({ checkinMinMinutes: value })
    this.afterChange()
  },

  onSound: function (e) {
    var value = !!e.detail.value
    this.setData({ soundOn: value })
    storage.setSettings({ soundOn: value })
    this.afterChange()
  }
})
