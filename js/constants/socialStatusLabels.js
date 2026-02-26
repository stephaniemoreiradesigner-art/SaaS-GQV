import { CALENDAR_STATUS, POST_STATUS } from './socialStatus.js';

export const CALENDAR_STATUS_LABEL = {
  [CALENDAR_STATUS.DRAFT]: 'Rascunho',
  [CALENDAR_STATUS.IN_PRODUCTION]: 'Em Produção',
  [CALENDAR_STATUS.AWAITING_APPROVAL]: 'Aguardando Aprovação',
  [CALENDAR_STATUS.APPROVED]: 'Aprovado',
  [CALENDAR_STATUS.PUBLISHED]: 'Publicado',
  [CALENDAR_STATUS.ARCHIVED]: 'Arquivado'
};

export const POST_STATUS_LABEL = {
  [POST_STATUS.DRAFT]: 'Rascunho',
  [POST_STATUS.BRIEFING_SENT]: 'Briefing Enviado',
  [POST_STATUS.DESIGN_IN_PROGRESS]: 'Em Produção',
  [POST_STATUS.READY_FOR_APPROVAL]: 'Pendente Aprovação',
  [POST_STATUS.APPROVED]: 'Aprovado',
  [POST_STATUS.REJECTED]: 'Ajustes Solicitados',
  [POST_STATUS.SCHEDULED]: 'Agendado',
  [POST_STATUS.PUBLISHED]: 'Publicado'
};
