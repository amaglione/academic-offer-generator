import axios from 'axios'

const client = axios.create({ baseURL: 'http://localhost:8000/api' })

export const STORAGE_KEY = 'auth'

let _token = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.token ?? null }
  catch { return null }
})()

// Storage persistence is handled by AuthContext.login() which has access to username.
// clearToken() clears storage to handle the 401 path from the axios interceptor.
export function setToken(token) { _token = token }
export function clearToken() {
  _token = null
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`
  return config
})

client.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
