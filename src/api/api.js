import axios from 'axios';

// Detect environment
const isCodespaces = window.location.hostname.includes('.app.github.dev');
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// URL logic: localhost -> local backend, Codespaces -> codespace backend, else -> production
const baseURL = isLocalhost
  ? 'http://localhost:5000/api'
  : isCodespaces
    ? window.location.origin.replace('-3000', '-5000') + '/api'
    : 'https://stock-flow-backend-three.vercel.app/api';

const API = axios.create({
  baseURL,
  timeout: 60000, // 60 seconds timeout for all requests
});

// Add request interceptor to include Authorization header
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle 401 errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const errorMessage = error.response.data?.message || '';
      // Handle any 401 error - either token expiration or password change
      console.log('401 Unauthorized detected, redirecting to login...');
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;
