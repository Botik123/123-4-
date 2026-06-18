import React from 'react';

const DateDivider = ({ date }) => {
  if (!date) return null;
  
  const today = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  let displayDate = date;
  if (date === today) displayDate = 'Сегодня';
  else if (date === yesterday) displayDate = 'Вчера';
  
  return (
    <div className="date-divider">
      <span>{displayDate}</span>
    </div>
  );
};

export default DateDivider;