import React, { memo, useState } from 'react';
import { parseFileMessage, getReplyPreview, getCleanText, escapeHtml } from '../../utils/helpers';
import { REACTIONS_LIST } from '../../utils/constants';

// Рендер файлового сообщения
const renderFileMessage = (fileData) => {
  if (!fileData) return null;

  switch (fileData.type) {
    case 'image':
      return (
        <div className="media-message image-message">
          <img 
            src={fileData.url} 
            alt="Изображение"
            onClick={() => window.open(fileData.url, '_blank')}
            loading="lazy"
          />
        </div>
      );

    case 'audio':
      if (fileData.url) {
        return (
          <div className="media-message audio-message">
            <div className="audio-player">
              <audio controls>
                <source src={fileData.url} type="audio/mpeg" />
              </audio>
              <div className="audio-name">{fileData.name}</div>
            </div>
          </div>
        );
      }
      return <div className="media-message file-message">🎵 {fileData.name}</div>;

    case 'video':
      if (fileData.url) {
        return (
          <div className="media-message video-message">
            <video controls>
              <source src={fileData.url} type="video/mp4" />
            </video>
            <div className="video-name">{fileData.name}</div>
          </div>
        );
      }
      return <div className="media-message file-message">🎬 {fileData.name}</div>;

    case 'file':
      if (fileData.url) {
        return (
          <div className="media-message file-message">
            <a href={fileData.url} download target="_blank" rel="noopener noreferrer">
              <div className="file-card">
                <span className="file-icon">📄</span>
                <span className="file-name">{fileData.name}</span>
                <span className="file-download">⬇️</span>
              </div>
            </a>
          </div>
        );
      }
      return <div className="media-message file-message">📎 {fileData.name}</div>;

    default:
      return null;
  }
};

// Рендер содержимого сообщения
const renderMessageContent = (msg) => {
  const isDeleted = msg.deleted || msg.text === '🗑️ Сообщение удалено';
  
  if (isDeleted) {
    return <span className="deleted-message">🗑️ Сообщение удалено</span>;
  }

  // Проверяем, является ли сообщение файлом
  const fileData = parseFileMessage(msg.text);
  if (fileData && fileData.type !== 'deleted') {
    return renderFileMessage(fileData);
  }

  // Проверяем, есть ли ответ
  const replyPreview = getReplyPreview(msg.text);
  const cleanText = getCleanText(msg.text);

  return (
    <>
      {replyPreview && (
        <div className="reply-preview-inline">
          <div className="reply-preview-label">↩️ Ответ</div>
          <div className="reply-preview-text">{replyPreview}</div>
        </div>
      )}
      <div 
        className="message-text-content" 
        dangerouslySetInnerHTML={{ __html: escapeHtml(cleanText || msg.text || '') }} 
      />
    </>
  );
};

const Message = memo(({ 
  message, 
  isOwn, 
  onReply, 
  onForward, 
  onEdit, 
  onDelete, 
  onReaction 
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  
  const isDeleted = message.deleted || message.text === '🗑️ Сообщение удалено';
  const msgReactions = message.reactions || {};
  const reactionEntries = Object.entries(msgReactions);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(message);
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Удалить сообщение?')) {
      onDelete(message.id);
    }
  };

  const handleReaction = (reaction) => {
    if (onReaction) {
      onReaction(message.id, reaction);
    }
    setShowReactionPicker(false);
  };

  return (
    <div className={`message ${isOwn ? 'sent' : 'received'} ${isDeleted ? 'deleted' : ''}`}>
      <div className="message-wrapper">
        {/* Message Actions */}
        {!isDeleted && (
          <div className="message-actions">
            <button onClick={() => onReply?.(message)} title="Ответить">↩️</button>
            <button onClick={() => onForward?.(message)} title="Переслать">📎</button>
            {isOwn && (
              <button onClick={handleEdit} title="Редактировать">✏️</button>
            )}
            <button 
              onClick={() => setShowReactionPicker(!showReactionPicker)} 
              title="Реакции"
            >
              😊
            </button>
            {isOwn && (
              <button onClick={handleDelete} title="Удалить">🗑️</button>
            )}
          </div>
        )}

        {/* Reactions Picker */}
        {!isDeleted && showReactionPicker && (
          <div className="reactions-picker">
            {REACTIONS_LIST.map(r => (
              <button key={r} onClick={() => handleReaction(r)}>
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Message Bubble */}
        <div className="bubble">
          {renderMessageContent(message)}
        </div>

        {/* Message Footer */}
        <div className="message-footer">
          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isOwn && !isDeleted && (
            <span className="read-status">{message.read ? '✓✓' : '✓'}</span>
          )}
          {message.edited && !isDeleted && <span className="edited-mark">(ред.)</span>}
        </div>

        {/* Reactions Display */}
        {!isDeleted && reactionEntries.length > 0 && (
          <div className="reactions-display">
            {reactionEntries.map(([userId, reaction]) => (
              <span key={userId} className="reaction">{reaction}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default Message;