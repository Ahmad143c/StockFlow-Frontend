import axios from 'axios';

// Detect if running in GitHub Codespaces
const isCodespaces = window.location.hostname.includes('.app.github.dev');

// In Codespaces, use the Codespaces URL with port 5000 for backend
// Otherwise, use proxy or explicit API URL
const baseURL = isCodespaces
  ? window.location.origin.replace('-3000', '-5000') + '/api'
  : import.meta.env.VITE_API_URL || '/api';

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
