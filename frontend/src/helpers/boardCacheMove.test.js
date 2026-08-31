import { describe, expect, it } from 'vitest';
import { insertTicketIntoPages, removeTicketFromPages } from './boardCacheMove';

const ticket = (id) => ({ _id: id, subject: `Ticket ${id}` });

// Two pages of the same query, with `pagination.total` repeated on both exactly
// as the list endpoint returns it. The column's count label only ever reads
// page 1's copy, so a move that shifts one page's total and not the other's
// shows a stale number — which is why every assertion below checks both.
const pagesOf = (...pageTicketIds) =>
  pageTicketIds.map((ids, index) => ({
    data: ids.map(ticket),
    pagination: { page: index + 1, pages: pageTicketIds.length, total: 5 },
  }));

describe('removeTicketFromPages', () => {
  it('removes a ticket sitting on page 1 and decrements every page total', () => {
    const pages = pagesOf(['a', 'b'], ['c']);

    const result = removeTicketFromPages(pages, 'a');

    expect(result.ticket).toEqual(ticket('a'));
    expect(result.pages[0].data.map((t) => t._id)).toEqual(['b']);
    expect(result.pages[1].data.map((t) => t._id)).toEqual(['c']);
    expect(result.pages.map((p) => p.pagination.total)).toEqual([4, 4]);
  });

  it('removes a ticket sitting on page 2', () => {
    const pages = pagesOf(['a', 'b'], ['c', 'd']);

    const result = removeTicketFromPages(pages, 'd');

    expect(result.ticket).toEqual(ticket('d'));
    expect(result.pages[0].data.map((t) => t._id)).toEqual(['a', 'b']);
    expect(result.pages[1].data.map((t) => t._id)).toEqual(['c']);
    expect(result.pages.map((p) => p.pagination.total)).toEqual([4, 4]);
  });

  it('is a no-op when the ticket is not in these pages', () => {
    const pages = pagesOf(['a', 'b']);

    const result = removeTicketFromPages(pages, 'missing');

    // Same reference back, so the caller can skip the cache write entirely.
    expect(result.pages).toBe(pages);
    expect(result.ticket).toBeNull();
  });

  it('removes from a page that carries no pagination object', () => {
    const pages = [{ data: [ticket('a'), ticket('b')] }];

    const result = removeTicketFromPages(pages, 'b');

    expect(result.ticket).toEqual(ticket('b'));
    expect(result.pages[0].data.map((t) => t._id)).toEqual(['a']);
    expect(result.pages[0].pagination).toBeUndefined();
  });

  it('never drives a total below zero', () => {
    const pages = [{ data: [ticket('a')], pagination: { total: 0 } }];

    const result = removeTicketFromPages(pages, 'a');

    expect(result.pages[0].pagination.total).toBe(0);
  });

  it('handles empty and missing page arrays', () => {
    expect(removeTicketFromPages([], 'a')).toEqual({ pages: [], ticket: null });
    expect(removeTicketFromPages(undefined, 'a')).toEqual({ pages: undefined, ticket: null });
  });
});

describe('insertTicketIntoPages', () => {
  it('prepends to page 1 and increments every page total', () => {
    const pages = pagesOf(['a'], ['b']);

    const result = insertTicketIntoPages(pages, ticket('new'));

    expect(result[0].data.map((t) => t._id)).toEqual(['new', 'a']);
    expect(result[1].data.map((t) => t._id)).toEqual(['b']);
    expect(result.map((p) => p.pagination.total)).toEqual([6, 6]);
  });

  it('is a no-op when the ticket is already in the pages', () => {
    const pages = pagesOf(['a'], ['b']);

    expect(insertTicketIntoPages(pages, ticket('b'))).toBe(pages);
  });

  it('inserts into a page that carries no pagination object', () => {
    const pages = [{ data: [ticket('a')] }];

    const result = insertTicketIntoPages(pages, ticket('new'));

    expect(result[0].data.map((t) => t._id)).toEqual(['new', 'a']);
    expect(result[0].pagination).toBeUndefined();
  });

  it('handles empty pages, missing pages and a ticket with no id', () => {
    expect(insertTicketIntoPages([], ticket('a'))).toEqual([]);
    expect(insertTicketIntoPages(undefined, ticket('a'))).toBeUndefined();
    expect(insertTicketIntoPages(pagesOf(['a']), {})).toEqual(pagesOf(['a']));
  });
});
