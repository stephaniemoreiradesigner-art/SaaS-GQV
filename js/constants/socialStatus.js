const CALENDAR_STATUS = {
  DRAFT: 'draft',
  IN_PRODUCTION: 'in_production',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

const POST_STATUS = {
  DRAFT: 'draft',
  BRIEFING_SENT: 'briefing_sent',
  DESIGN_IN_PROGRESS: 'design_in_progress',
  READY_FOR_APPROVAL: 'ready_for_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published'
};

if (typeof window !== 'undefined') {
  window.CALENDAR_STATUS = CALENDAR_STATUS;
  window.POST_STATUS = POST_STATUS;
}
