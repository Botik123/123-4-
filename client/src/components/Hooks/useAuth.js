/**
 * @file client/src/components/Hooks/useAuth.js
 * @description Custom hook для аутентификации
 * Управление состоянием пользователя, логин, регистрация, logout
 */

import { useState, useEffect } from 'react';
import { authAPI } from '../../api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Проверка токена при монтировании
  useEffect(() => {
    if (token) {
      // TODO: Проверить токен через /auth/me
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [token]);

  /**
   * Войти в аккаунт
   * @param {string} username 
   * @param {string} password 
   * @returns {object} { success: boolean, error?: string }
   */
  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Зарегистрировать нового пользователя
   * @param {string} username 
   * @param {string} password 
   * @returns {object} { success: boolean, error?: string }
   */
  const register = async (username, password) => {
    try {
      const data = await authAPI.register(username, password);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Выйти из аккаунта
   */
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return { user, loading, login, register, logout, token };
};