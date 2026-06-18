import React from 'react';
import ChatHeader from './ChatHeader';
import Messages from './Messages';
import MessageInput from './MessageInput';
import ReplyBar from './ReplyBar';
import TypingIndicator from './TypingIndicator';
import EmptyChat from './EmptyChat';

const ChatArea = ({
  selectedUser,
  messages,
  currentUserId,
  typing,
  replyTo,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReaction,
  onSendMessage,
  onFileSend,
  onTyping,
  onSetReplyTo,
  isConnecting,
  onBack,
  isMobileOpen,
  loading // 🔥 Добавляем пропс
}) => {
  if (!selectedUser) {
    return <EmptyChat />;
  }

  return (
    <div className={`chat-area ${isMobileOpen ? 'mobile-open' : ''}`}>
      <ChatHeader 
        user={selectedUser}
        typing={typing}
        isOnline={selectedUser.online}
        onBack={onBack}
      />
      
      <Messages 
        messages={messages}
        currentUserId={currentUserId}
        onReply={onReply}
        onForward={onForward}
        onEdit={onEdit}
        onDelete={onDelete}
        onReaction={onReaction}
        loading={loading} // 🔥 Передаём loading
      />
      
      {typing && <TypingIndicator username={selectedUser.username} />}
      
      {replyTo && (
        <ReplyBar 
          replyTo={replyTo} 
          onClose={() => onSetReplyTo(null)} 
        />
      )}
      
      <MessageInput 
        onSend={onSendMessage}
        onFileSend={onFileSend}
        onTyping={onTyping}
        disabled={isConnecting}
      />
    </div>
  );
};

export default ChatArea;