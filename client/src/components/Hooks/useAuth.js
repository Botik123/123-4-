/**
 * @file client/src/components/Hooks/useAuth.js
 * @description Custom hook для аутентификации
 * Управление состоянием пользователя, логин, регистрация, logout
 */

import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../../api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Проверка сессии при монтировании (из куки)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('http://localhost:3002/auth/me', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
  }, []);

  /**
   * Войти в аккаунт
   * @param {string} username 
   * @param {string} password 
   * @returns {object} { success: boolean, error?: string }
   */
  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
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
      setUser(data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Выйти из аккаунта
   */
  const logout = useCallback(async () => {
    try {
      await fetch('http://localhost:3002/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }, []);

  return { user, loading, login, register, logout };
};