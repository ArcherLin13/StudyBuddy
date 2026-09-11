var firebase = require('./firebase.js')
var storage = require('./storage.js')

function recordId(r) {
  if (r && r.id) return r.id
  return 'r_' + r.startTs + '_' + r.endTs + '_' + r.subjectId + '_' + r.seconds
}

function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (isFinite(value) && Math.floor(value) === value && Math.abs(value) < 1e15) {
      return { integerValue: String(value) }
    }
    return { doubleValue: value }
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toValue)
      }
    }
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFields(value) } }
  }
  return { stringValue: String(value) }
}

function toFields(obj) {
  var fields = {}
  Object.keys(obj || {}).forEach(function (key) {
    if (obj[key] !== undefined) fields[key] = toValue(obj[key])
  })
  return fields
}

function fromValue(value) {
  if (!value) return null
  if (value.stringValue !== undefined) return value.stringValue
  if (value.integerValue !== undefined) return Number(value.integerValue)
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.booleanValue !== undefined) return value.booleanValue
  if (value.nullValue !== undefined) return null
  if (value.mapValue) return fromFields(value.mapValue.fields)
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(fromValue)
  }
  return null
}

function fromFields(fields) {
  var obj = {}
  Object.keys(fields || {}).forEach(function (key) {
    obj[key] = fromValue(fields[key])
  })
  return obj
}

function mergeRecords(local, remote) {
  var map = {}
  local.concat(remote).forEach(function (r) {
    if (!r || !r.startTs) return
    var id = recordId(r)
    if (!map[id]) map[id] = Object.assign({}, r, { id: id })
  })
  return Object.keys(map)
    .map(function (id) {
      return map[id]
    })
    .sort(function (a, b) {
      return (a.startTs || 0) - (b.startTs || 0)
    })
}

function listRemoteRecords(uid) {
  var collected = []
  function page(token) {
    var path = '/users/' + uid + '/studybuddy_records?pageSize=300'
    if (token) path += '&pageToken=' + encodeURIComponent(token)
    return firebase.firestoreRequest(path, 'GET').then(function (body) {
      ;(body.documents || []).forEach(function (doc) {
        var data = fromFields(doc.fields)
        if (data && data.startTs) {
          var parts = (doc.name || '').split('/')
          data.id = data.id || parts[parts.length - 1]
          collected.push(data)
        }
      })
      if (body.nextPageToken) return page(body.nextPageToken)
      return collected
    })
  }
  return page('')
}

function getRemoteMeta(uid) {
  return firebase.firestoreRequest('/users/' + uid + '/studybuddy_meta/app', 'GET').then(function (body) {
    return fromFields(body.fields)
  }).catch(function () {
    return null
  })
}

function putRecord(uid, record) {
  var id = recordId(record)
  var data = Object.assign({}, record, { id: id })
  return firebase.firestoreRequest(
    '/users/' + uid + '/studybuddy_records/' + encodeURIComponent(id),
    'PATCH',
    { fields: toFields(data) }
  )
}

function deleteRecord(uid, record) {
  var id = recordId(record)
  return firebase.firestoreRequest(
    '/users/' + uid + '/studybuddy_records/' + encodeURIComponent(id),
    'DELETE'
  ).catch(function () {
    return null
  })
}

function putMeta(uid, meta) {
  return firebase.firestoreRequest(
    '/users/' + uid + '/studybuddy_meta/app',
    'PATCH',
    { fields: toFields(meta) }
  )
}

function runSerial(items, worker) {
  var chain = Promise.resolve()
  items.forEach(function (item) {
    chain = chain.then(function () {
      return worker(item)
    })
  })
  return chain
}

function syncStudyData() {
  if (!firebase.getAuth()) return Promise.resolve()
  return firebase.requireAuth().then(function (auth) {
    var localRecords = storage.getRecords()
    var localSubjects = storage.getSubjects()
    var localSettings = storage.getSettings()
    var localMeta = storage.getWeekMeta()
    var localPayouts = storage.getPayouts()
    return Promise.all([
      listRemoteRecords(auth.uid),
      getRemoteMeta(auth.uid)
    ]).then(function (pair) {
      var remoteRecords = pair[0]
      var remote = pair[1]
      var merged = mergeRecords(localRecords, remoteRecords)
      storage.setRecords(merged)

      var localUpdated = localSettings.updatedAt || 0
      var remoteUpdated = (remote && remote.updatedAt) || 0
      var subjects = localSubjects
      var settings = localSettings
      var weekMeta = localMeta
      var payouts = Object.assign({}, (remote && remote.payouts) || {}, localPayouts)

      if (remote && remoteUpdated >= localUpdated) {
        if (remote.subjects && remote.subjects.length) {
          subjects = storage.setSubjects(remote.subjects)
        }
        if (remote.settings) {
          settings = storage.setSettings(Object.assign({}, localSettings, remote.settings))
        }
        if (remote.weekMeta) {
          weekMeta = Object.assign({}, localMeta, remote.weekMeta)
          storage.setWeekMeta(weekMeta)
        }
        storage.savePayouts(payouts)
      } else {
        return putMeta(auth.uid, {
          subjects: subjects,
          settings: settings,
          weekMeta: weekMeta,
          payouts: payouts,
          updatedAt: Math.max(localUpdated, Date.now())
        }).then(function () {
          return runSerial(merged, function (r) {
            return putRecord(auth.uid, r)
          })
        }).then(function () {
          return { records: merged, subjects: subjects, settings: settings }
        })
      }

      return runSerial(merged, function (r) {
        return putRecord(auth.uid, r)
      }).then(function () {
        return { records: merged, subjects: subjects, settings: settings }
      })
    })
  })
}

function persistRecordChange(records, removed) {
  if (!firebase.getAuth()) return Promise.resolve()
  return firebase.requireAuth().then(function (auth) {
    return runSerial(removed || [], function (r) {
      return deleteRecord(auth.uid, r)
    }).then(function () {
      return runSerial(records || [], function (r) {
        return putRecord(auth.uid, r)
      })
    })
  }).catch(function () {
    return null
  })
}

function pushStudyData() {
  if (!firebase.getAuth()) return Promise.resolve()
  return syncStudyData().catch(function () {
    return null
  })
}

module.exports = {
  recordId: recordId,
  syncStudyData: syncStudyData,
  persistRecordChange: persistRecordChange,
  pushStudyData: pushStudyData
}
