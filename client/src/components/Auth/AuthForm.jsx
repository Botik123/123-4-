import React, { useState } from 'react';

const AuthForm = ({ onLogin, onRegister, loading }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (username.length < 3 || username.length > 20) {
      alert('Имя пользователя должно быть от 3 до 20 символов');
      return;
    }

    if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(username)) {
      alert('Имя пользователя содержит недопустимые символы');
      return;
    }

    if (password.length < 4) {
      alert('Пароль должен быть минимум 4 символа');
      return;
    }

    if (isLogin) {
      await onLogin(username, password);
    } else {
      await onRegister(username, password);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-particles">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>
      
      <div className="auth-box">
        <div className="auth-logo-wrapper">
          <div className="auth-logo">💬</div>
        </div>
        <h2>{isLogin ? 'Добро пожаловать' : 'Создать аккаунт'}</h2>
        <p className="subtitle">
          {isLogin ? 'Войдите в свой аккаунт' : 'Зарегистрируйтесь и начните общение'}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <span className="input-icon">👤</span>
            <input
              type="text"
              placeholder="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="btn-loader"></span>
            ) : (
              isLogin ? 'Войти' : 'Зарегистрироваться'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>или</span>
        </div>
        
        <span 
          className="toggle-auth" 
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
        </span>
      </div>
    </div>
  );
};

export default AuthForm;