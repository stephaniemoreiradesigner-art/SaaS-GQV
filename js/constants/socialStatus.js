const CALENDAR_STATUS = {
  DRAFT: 'draft',
  IN_PRODUCTION: 'in_production',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

if (typeof window !== 'undefined') {
  window.CALENDAR_STATUS = CALENDAR_STATUS;
  window.POST_STATUS = window.POST_STATUS || Object.freeze({
    DRAFT: 'draft',
    READY_FOR_APPROVAL: 'ready_for_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  });
}
