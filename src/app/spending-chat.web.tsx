import React from 'react';
import { WebDeferredFeature } from '../components/web/WebDeferredFeature';

export default function SpendingChatWebDeferred() {
  return (
    <WebDeferredFeature
      title="AI Spending Chat trên Web"
      phase="P2.4"
      body="Chat chi tiêu trên Web sẽ chạy qua Edge turn (tools + LLM) ở giai đoạn sau. Android P1.8A vẫn dùng local SQLite."
    />
  );
}
