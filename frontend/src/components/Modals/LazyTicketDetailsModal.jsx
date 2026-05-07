import React, { Suspense, lazy } from 'react';

const TicketDetailsModal = lazy(() => import('./TicketDetailsModal'));

export default function LazyTicketDetailsModal(props) {
  return (
    <Suspense fallback={null}>
      <TicketDetailsModal {...props} />
    </Suspense>
  );
}
