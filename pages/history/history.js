var storage = require('../../utils/storage.js')
var score = require('../../utils/score.js')

Page({
  data: {
    weeks: [],
    expandedWeekId: ''
  },

  onShow: function () {
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

  onToggle: function (e) {
    var id = e.currentTarget.dataset.id
    var next = this.data.expandedWeekId === id ? '' : id
    this.setData({
      expandedWeekId: next,
      weeks: this.data.weeks.map(function (w) {
        return Object.assign({}, w, { expanded: w.weekId === next })
      })
    })
  }
})
