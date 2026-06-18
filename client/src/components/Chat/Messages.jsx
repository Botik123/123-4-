import React, { useRef, useEffect } from 'react';
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="messages-container">
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