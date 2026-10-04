import React from 'react';
import { WebDeferredFeature } from '../components/web/WebDeferredFeature';

export default function CameraWebDeferred() {
  return (
    <WebDeferredFeature
      title="Quét hoá đơn trên Web"
      phase="P2.3"
      body="Chụp / quét hoá đơn trên Web sẽ dùng Edge AI proxy ở P2.3. Android vẫn dùng camera local như hiện tại."
    />
  );
}
