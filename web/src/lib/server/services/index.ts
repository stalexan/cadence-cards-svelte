/**
 * Services Layer - Business Logic
 *
 * This module provides a centralized export for all service classes.
 * Services contain business logic and database operations, keeping
 * API routes thin and focused on HTTP concerns.
 */

export { cardService, CardService } from './card-service';
export type {
	CardQueryParams,
	CreateCardParams,
	UpdateCardParams,
	FormattedCard
} from './card-service';

export { studyService, StudyService } from './study-service';
export type { StudySessionParams, StudyCard } from './study-service';
export type { StudyStats } from '$lib/types/domain';

export { topicService, TopicService } from './topic-service';
export type { CreateTopicParams, UpdateTopicParams, TopicWithCounts } from './topic-service';

export { deckService, DeckService } from './deck-service';
export type { CreateDeckParams, UpdateDeckParams, FormattedDeck } from './deck-service';

export { dashboardService, DashboardService } from './dashboard-service';
export type { DashboardStats } from '$lib/types/domain';

export { importService, ImportService } from './import-service';
export type { ImportCardsParams, ImportResult } from './import-service';

export { scheduleService, ScheduleService } from './schedule-service';
export type { RecordReviewParams, FormattedSchedule } from './schedule-service';
