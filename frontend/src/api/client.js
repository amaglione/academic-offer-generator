import axios from 'axios'

const client = axios.create({ baseURL: 'http://localhost:8000/api' })

let _token = null

export function setToken(token) { _token = token }
export function clearToken() { _token = null }

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
