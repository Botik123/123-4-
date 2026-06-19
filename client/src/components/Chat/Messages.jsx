import React, { useRef, useEffect, useState } from 'react';
import Message from './Message';
import DateDivider from '../Common/DateDivider';
import Skeleton from '../Common/Skeleton';
import { groupMessagesByDate } from '../../utils/helpers';

const Messages = ({ 
  messages, 
  currentUserId, 
  onReply, 
  onForward, 
  onEdit, 
  onDelete, 
  onReaction,
  loading // 🔥 Добавляем пропс loading
}) => {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [prevMessagesLength, setPrevMessagesLength] = useState(messages.length);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const prevCurrentUserIdRef = useRef(null);

  const isAtBottom = () => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  const handleScroll = () => {
    if (containerRef.current) {
      setUserScrolled(!isAtBottom());
    }
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // 🔥 Прокрутка вниз при первом запуске
  useEffect(() => {
    if (messages.length > 0 && isFirstLoad) {
      const timer = setTimeout(() => {
        scrollToBottom('auto');
        setIsFirstLoad(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isFirstLoad]);

  // 🔥 Прокрутка вниз при смене чата
  useEffect(() => {
    // Проверяем что текущий пользователь изменился (сменили чат)
    if (prevCurrentUserIdRef.current !== currentUserId && messages.length > 0) {
      console.log(`🔄 Смена чата: прокрутка вниз (${messages.length} сообщений)`);
      const timer = setTimeout(() => {
        scrollToBottom('auto');
        setUserScrolled(false);
      }, 100);
      return () => clearTimeout(timer);
    }
    prevCurrentUserIdRef.current = currentUserId;
  }, [currentUserId, messages.length]);

  // 🔥 Прокрутка при новых сообщениях
  useEffect(() => {
    if (messages.length > prevMessagesLength) {
      const lastMsg = messages[messages.length - 1];
      const isOwnMessage = lastMsg && lastMsg.from_user === currentUserId;
      
      if (!userScrolled || isOwnMessage) {
        scrollToBottom('smooth');
      }
      
      setPrevMessagesLength(messages.length);
    }
  }, [messages, currentUserId, userScrolled]);

  // 🔥 ПОКАЗЫВАЕМ СКЕЛЕТОН ВО ВРЕМЯ ЗАГРУЗКИ
  if (loading) {
    return (
      <div className="messages-container">
        <div className="date-divider"><span>Загрузка...</span></div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton 
            key={i} 
            type={i % 2 === 0 ? 'message-sent' : 'message-received'} 
          />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="messages-container empty">
        <div className="empty-chat-small">
          <div className="empty-icon">💬</div>
          <p>Нет сообщений. Начните диалог!</p>
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div 
      className="messages-container" 
      ref={containerRef}
      onScroll={handleScroll}
    >
      {groupedMessages.map((group, index) => (
        <React.Fragment key={`group-${index}-${group.date}`}>
          <DateDivider date={group.date} />
          {group.messages.map(msg => (
            <Message
              key={msg.id || `msg-${Math.random()}`}
              message={msg}
              isOwn={msg.from_user === currentUserId}
              onReply={onReply}
              onForward={onForward}
              onEdit={onEdit}
              onDelete={onDelete}
              onReaction={onReaction}
              allMessages={messages}
            />
          ))}
        </React.Fragment>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default Messages;