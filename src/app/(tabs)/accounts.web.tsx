import React from 'react';
import { WebDeferredFeature } from '../../components/web/WebDeferredFeature';

export default function AccountsWebDeferred() {
  return (
    <WebDeferredFeature
      title="Tài khoản Woori / VPBank"
      phase="Sắp có"
      body="Màn hình Tài khoản cloud (Woori quỹ ăn, số dư VPBank) chưa mở trên Web ở P2.2. Android Accounts vẫn dùng SQLite như cũ."
    />
  );
}