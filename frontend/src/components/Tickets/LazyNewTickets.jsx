import React, { Suspense, lazy } from 'react';

const NewTickets = lazy(() => import('./NewTickets'));

export default function LazyNewTickets(props) {
  return (
    <Suspense fallback={null}>
      <NewTickets {...props} />
    </Suspense>
  );
}
