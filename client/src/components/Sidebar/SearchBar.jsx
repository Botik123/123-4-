import React from 'react';

const SearchBar = ({ value, onChange, placeholder = 'Поиск контактов...' }) => {
  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;