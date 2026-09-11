var AUTH_KEY = 'studybuddy.firebase.auth'
var API_KEY = 'AIzaSyBX6CId7-RATf0P6cz5-DDqFf6nQu0rmoo'
var PROJECT_ID = 'playbuddy-ca350'

function request(options) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data,
      header: options.header || {},
      success: function (res) {
        var body = res.data
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body)
          return
        }
        var msg = (body && body.error && body.error.message) || '请求失败'
        reject(new Error(msg))
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '网络异常'))
      }
    })
  })
}

function getAuth() {
  return wx.getStorageSync(AUTH_KEY) || null
}

function setAuth(auth) {
  if (!auth) {
    wx.removeStorageSync(AUTH_KEY)
    return null
  }
  wx.setStorageSync(AUTH_KEY, auth)
  return auth
}

function saveSession(data) {
  var expiresIn = Number(data.expiresIn || data.expires_in || 3600)
  return setAuth({
    email: data.email || (getAuth() && getAuth().email) || '',
    uid: data.localId || data.user_id,
    idToken: data.idToken || data.id_token,
    refreshToken: data.refreshToken || data.refresh_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000
  })
}

function authErrorMessage(message) {
  var text = String(message || '')
  if (text.indexOf('EMAIL_EXISTS') >= 0) return '该邮箱已注册，请直接登录'
  if (text.indexOf('EMAIL_NOT_FOUND') >= 0 || text.indexOf('INVALID_PASSWORD') >= 0) {
    return '邮箱或密码错误'
  }
  if (text.indexOf('INVALID_EMAIL') >= 0) return '邮箱格式不正确'
  if (text.indexOf('WEAK_PASSWORD') >= 0) return '密码至少 6 位'
  if (text.indexOf('INVALID_LOGIN_CREDENTIALS') >= 0) return '邮箱或密码错误'
  if (text.indexOf('USER_DISABLED') >= 0) return '该账号已被停用'
  if (text.indexOf('TOO_MANY_ATTEMPTS') >= 0) return '尝试次数过多，请稍后再试'
  if (text.indexOf('request:fail') >= 0) return '连不上云端。开发者工具请勾选「不校验合法域名」'
  return text || '操作失败'
}

function signIn(email, password) {
  return request({
    url: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { email: email, password: password, returnSecureToken: true }
  }).then(saveSession)
}

function register(email, password) {
  return request({
    url: 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { email: email, password: password, returnSecureToken: true }
  }).then(saveSession)
}

function refreshAuth() {
  var auth = getAuth()
  if (!auth || !auth.refreshToken) return Promise.reject(new Error('请先登录账号'))
  return request({
    url: 'https://securetoken.googleapis.com/v1/token?key=' + API_KEY,
    method: 'POST',
    header: { 'content-type': 'application/x-www-form-urlencoded' },
    data: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refreshToken)
  }).then(function (data) {
    data.email = auth.email
    return saveSession(data)
  })
}

function requireAuth() {
  var auth = getAuth()
  if (!auth || !auth.idToken || !auth.uid) {
    return Promise.reject(new Error('请先登录账号'))
  }
  if (auth.expiresAt && Date.now() < auth.expiresAt) {
    return Promise.resolve(auth)
  }
  return refreshAuth()
}

function signOut() {
  setAuth(null)
}

function firestoreRequest(path, method, data) {
  return requireAuth().then(function (auth) {
    return request({
      url: 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents' + path,
      method: method,
      header: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + auth.idToken
      },
      data: data
    })
  })
}

module.exports = {
  API_KEY: API_KEY,
  PROJECT_ID: PROJECT_ID,
  getAuth: getAuth,
  signIn: signIn,
  register: register,
  signOut: signOut,
  requireAuth: requireAuth,
  firestoreRequest: firestoreRequest,
  authErrorMessage: authErrorMessage
}
