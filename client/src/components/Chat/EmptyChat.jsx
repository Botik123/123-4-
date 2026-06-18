import React from 'react';

const EmptyChat = () => {
  return (
    <div className="empty-chat">
      <div className="empty-icon">💬</div>
      <h3>Выберите чат</h3>
      <p>Начните общение, выбрав контакт из списка слева</p>
    </div>
  );
};

export default EmptyChat;