import React from 'react';

const Loader = ({ size = 'medium', color = 'var(--tg-primary)' }) => {
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 60
  };

  const pixelSize = sizeMap[size] || sizeMap.medium;

  return (
    <div 
      className="loader"
      style={{
        width: pixelSize,
        height: pixelSize,
        border: `3px solid ${color}20`,
        borderTop: `3px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}
    />
  );
};

export default Loader;