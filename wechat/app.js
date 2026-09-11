App({
  onLaunch: function () {
    require('./utils/storage.js').getSubjects()
    require('./utils/storage.js').getSettings()
  }
})
