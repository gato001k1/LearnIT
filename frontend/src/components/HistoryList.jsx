import React from 'react';

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return 'Unknown time';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return date.toLocaleString();
};

const HistoryList = ({ history = [], loading = false, onSelect }) => {
  if (loading) {
    return (
      <div className="history-list">
        <div className="history-loading">Loading clipboard history…</div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="history-list">
        <div className="empty-state">
          No clipboard history yet. Start copying some text!
        </div>
      </div>
    );
  }

  return (
    <div className="history-list">
      {history.map((item) => (
        <button
          key={item.timestamp ?? item.id}
          type="button"
          className="history-item"
          onClick={() => onSelect(item.text)}
        >
          <div className="history-item-text" title={item.text}>
            {item.text || '— Empty string —'}
          </div>
          <div className="history-item-time">
            {formatTimestamp(item.timestamp)}
          </div>
        </button>
      ))}
    </div>
  );
};

export default HistoryList;
