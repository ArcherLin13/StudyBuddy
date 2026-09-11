App({
  onLaunch: function () {
    require('./utils/storage.js').getSubjects()
    require('./utils/storage.js').getSettings()
    var firebase = require('./utils/firebase.js')
    var sync = require('./utils/sync.js')
    if (firebase.getAuth()) {
      sync.pushStudyData()
    }
  }
})
