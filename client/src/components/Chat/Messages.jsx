import React, { useRef, useEffect, useState } from 'react';
import Message from './Message';
import DateDivider from '../Common/DateDivider';
import { groupMessagesByDate } from '../../utils/helpers';

const Messages = ({ 
  messages, 
  currentUserId, 
  onReply, 
  onForward, 
  onEdit, 
  onDelete, 
  onReaction 
}) => {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [prevMessagesLength, setPrevMessagesLength] = useState(messages.length);

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

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (messages.length > prevMessagesLength) {
      const lastMsg = messages[messages.length - 1];
      const isOwnMessage = lastMsg && lastMsg.from_user === currentUserId;
      
      if (!userScrolled || isOwnMessage) {
        scrollToBottom();
      }
      
      setPrevMessagesLength(messages.length);
    }
  }, [messages, currentUserId, userScrolled]);

  useEffect(() => {
    scrollToBottom();
  }, []);

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