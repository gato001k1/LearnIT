import React from 'react';

const toneClassMap = {
  success: 'status success',
  error: 'status error',
  warning: 'status warning',
  info: 'status info',
};

const StatusBanner = ({ status }) => {
  if (!status?.visible || !status?.message) {
    return null;
  }

  const toneClass = toneClassMap[status.tone] || toneClassMap.info;

  return (
    <div className={toneClass} role="status">
      {status.message}
    </div>
  );
};

export default StatusBanner;
