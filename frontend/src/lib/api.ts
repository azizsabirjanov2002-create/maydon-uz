import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Инцептор для добавления токена, если он есть в localStorage (пока используем клиентский подход)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Глобальная обработка 401/403 ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === 'undefined') return Promise.reject(error);

    const status = error.response?.status;
    const currentPath = window.location.pathname;
    
    // Игнорируем редиректы, если мы уже на страницах авторизации
    const authPages = ['/login', '/register', '/auth/verify'];
    if (authPages.includes(currentPath)) {
       return Promise.reject(error);
    }

    if (status === 401) {
       // Токен протух или отсутствует — разлогиниваем и кидаем на /login с сохранением стейта
       localStorage.removeItem('accessToken');
       localStorage.removeItem('refreshToken');
       
       const currentUrl = encodeURIComponent(currentPath + window.location.search);
       window.location.href = `/login?callbackUrl=${currentUrl}`;
    } 
    else if (status === 403) {
       // Пользователь недопущен (wrong role или unverified)
       // Исключение: бронирование само обрабатывает 403 (Verify Phone)
       if (!currentPath.includes('/book')) {
          // Кидаем на главную, если сунулся в чужую зону
          window.location.href = '/';
       }
    }

    return Promise.reject(error);
  }
);
