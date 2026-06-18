import React from 'react';
import { getAvatarColor } from '../../utils/helpers';

const Avatar = ({ name, size = 'medium', online = false, className = '' }) => {
  const sizeMap = {
    small: { width: 40, height: 40, fontSize: 16 },
    medium: { width: 48, height: 48, fontSize: 20 },
    large: { width: 56, height: 56, fontSize: 24 }
  };

  const { width, height, fontSize } = sizeMap[size] || sizeMap.medium;

  return (
    <div 
      className={`avatar ${className}`}
      style={{ 
        width, 
        height, 
        background: getAvatarColor(name),
        fontSize,
        position: 'relative',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        flexShrink: 0
      }}
    >
      {name?.[0]?.toUpperCase() || 'U'}
      {online && (
        <span 
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '13px',
            height: '13px',
            background: '#22c55e',
            borderRadius: '50%',
            border: '2px solid white'
          }}
        />
      )}
    </div>
  );
};

export default Avatar;