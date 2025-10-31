import React from 'react';

const Toolbar = ({
  isCopying,
  isPasting,
  isProcessing,
  operation,
  operations,
  onCopy,
  onPaste,
  onProcess,
  onOperationChange,
}) => (
  <div className="toolbar">
    <div className="button-row">
      <button
        type="button"
        className="button primary"
        onClick={onCopy}
        disabled={isCopying}
      >
        {isCopying ? 'Copying…' : '📋 Copy to Clipboard'}
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={onPaste}
        disabled={isPasting}
      >
        {isPasting ? 'Pasting…' : '📄 Paste from Clipboard'}
      </button>
    </div>

    <label className="field-label" htmlFor="operationSelect">Text Operations:</label>
    <select
      id="operationSelect"
      className="select-input"
      value={operation}
      onChange={(event) => onOperationChange(event.target.value)}
    >
      {operations.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    <button
      type="button"
      className="button process"
      onClick={onProcess}
      disabled={isProcessing}
    >
      {isProcessing ? 'Processing…' : '⚡ Process Text'}
    </button>
  </div>
);

export default Toolbar;
