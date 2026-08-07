import { describe, it, expect } from 'vitest';
import {
	exportCardsToYaml,
	importCardsFromYaml,
	convertYamlCardsToDatabaseFormat,
	toDatabaseCards,
	type CardWithSchedules,
	type DatabaseCard,
	type ExportMetadata
} from './yaml-utils';
import { Grade, Priority } from './sm2';

const sampleCards: DatabaseCard[] = [
	{
		front: 'Bonjour',
		back: 'Hello',
		note: 'a greeting',
		lastSeen: new Date('2024-01-15T00:00:00.000Z'),
		priority: Priority.A,
		grade: Grade.CORRECT_PERFECT_RECALL,
		// Above the 2.5 starting value — SM-2 raises easiness past 2.5 on repeated perfect
		// recall, and such cards must survive an export/import roundtrip.
		repCount: 3,
		easiness: 2.7,
		interval: 16,
		tags: ['french', 'greetings']
	},
	{
		front: 'Merci',
		back: 'Thank you',
		note: null,
		lastSeen: null,
		priority: Priority.B,
		grade: null,
		repCount: 0,
		easiness: 2.5,
		interval: 1,
		tags: []
	}
];

const metadata: ExportMetadata = {
	formatVersion: '1.0',
	deckName: 'French Basics',
	creatorName: 'Sean',
	exportDate: '2024-01-20',
	cardCount: 2,
	isBidirectional: false
};

// A card from a bidirectional deck: the two directions have diverged, so exporting only the
// forward numbers would lose real study progress.
const bidirectionalCard: DatabaseCard = {
	...sampleCards[0],
	reverseLastSeen: new Date('2024-02-01T00:00:00.000Z'),
	reverseGrade: Grade.CORRECT_WITH_HESITATION,
	reverseRepCount: 2,
	reverseEasiness: 2.4,
	reverseInterval: 6
};

// Shaped like what cardService.getCards returns.
const serviceCards: CardWithSchedules[] = [
	{
		front: 'Bonjour',
		back: 'Hello',
		note: 'a greeting',
		priority: Priority.A,
		tags: ['french', 'greetings'],
		schedules: [
			{
				isReversed: false,
				lastSeen: new Date('2024-01-15T00:00:00.000Z'),
				grade: Grade.CORRECT_PERFECT_RECALL,
				repCount: 3,
				easiness: 2.7,
				interval: 16
			},
			{
				isReversed: true,
				lastSeen: new Date('2024-02-01T00:00:00.000Z'),
				grade: Grade.CORRECT_WITH_HESITATION,
				repCount: 2,
				easiness: 2.4,
				interval: 6
			}
		]
	}
];

describe('exportCardsToYaml / importCardsFromYaml roundtrip', () => {
	it('preserves core fields without SM-2 params or metadata', () => {
		const yaml = exportCardsToYaml(sampleCards);
		const { valid, invalid } = importCardsFromYaml(yaml);

		expect(invalid).toHaveLength(0);
		expect(valid).toHaveLength(2);
		expect(valid[0].Front).toBe('Bonjour');
		expect(valid[0].Back).toBe('Hello');
		expect(valid[0].Priority).toBe(Priority.A);
		expect(valid[0].Tags).toEqual(['french', 'greetings']);
		// SM-2 params were not exported, so schema defaults apply on import.
		expect(valid[0].Easiness).toBe(2.5);
		expect(valid[0].Interval).toBe(1);
	});

	it('roundtrips through a metadata header (comments are ignored on import)', () => {
		const yaml = exportCardsToYaml(sampleCards, metadata);
		expect(yaml).toContain('# Deck: French Basics');

		const { valid, invalid } = importCardsFromYaml(yaml);
		expect(invalid).toHaveLength(0);
		expect(valid.map((c) => c.Front)).toEqual(['Bonjour', 'Merci']);
	});

	it('includes and roundtrips SM-2 params when requested', () => {
		const yaml = exportCardsToYaml(sampleCards, undefined, true);
		const { valid } = importCardsFromYaml(yaml);

		expect(valid[0].LastSeen).toBe('2024-01-15');
		expect(valid[0].Grade).toBe(Grade.CORRECT_PERFECT_RECALL);
		expect(valid[0].RepCount).toBe(3);
		// Easiness above the 2.5 starting value must not be rejected (no upper cap in schema).
		expect(valid[0].Easiness).toBe(2.7);
		expect(valid[0].Interval).toBe(16);
		// Null lastSeen exports as null and survives the roundtrip.
		expect(valid[1].LastSeen).toBeNull();
	});

	it('exports both directions for a bidirectional card', () => {
		const yaml = exportCardsToYaml([bidirectionalCard], undefined, true);
		const { valid } = importCardsFromYaml(yaml);

		// Forward values are untouched...
		expect(valid[0].RepCount).toBe(3);
		expect(valid[0].Easiness).toBe(2.7);
		// ...and the reverse direction is its own, distinct set — not a copy of the forward one.
		expect(valid[0].ReverseLastSeen).toBe('2024-02-01');
		expect(valid[0].ReverseGrade).toBe(Grade.CORRECT_WITH_HESITATION);
		expect(valid[0].ReverseRepCount).toBe(2);
		expect(valid[0].ReverseEasiness).toBe(2.4);
		expect(valid[0].ReverseInterval).toBe(6);
	});

	it('exports reverse params for an unstudied reverse schedule', () => {
		const yaml = exportCardsToYaml(
			[
				{
					...sampleCards[0],
					reverseLastSeen: null,
					reverseGrade: null,
					reverseRepCount: 0,
					reverseEasiness: 2.5,
					reverseInterval: 1
				}
			],
			undefined,
			true
		);

		// A reverse schedule that exists but has never been reviewed must still round-trip, otherwise
		// the importer can't tell the deck has a second direction at all.
		expect(yaml).toContain('ReverseEasiness');
		const { valid } = importCardsFromYaml(yaml);
		expect(valid[0].ReverseLastSeen).toBeNull();
		expect(valid[0].ReverseGrade).toBeNull();
		expect(valid[0].ReverseRepCount).toBe(0);
	});

	it('omits reverse params for cards with no reverse schedule', () => {
		// The original bug in reverse: unidirectional decks must not gain phantom reverse data.
		const yaml = exportCardsToYaml(sampleCards, undefined, true);
		expect(yaml).not.toContain('Reverse');
	});

	it('omits all SM-2 params, forward and reverse, when not requested', () => {
		const yaml = exportCardsToYaml([bidirectionalCard], undefined, false);
		expect(yaml).not.toContain('Reverse');
		expect(yaml).not.toContain('Easiness');
	});

	it('records deck bidirectionality in the metadata header', () => {
		const yaml = exportCardsToYaml(sampleCards, { ...metadata, isBidirectional: true });
		expect(yaml).toContain('# Bidirectional: Yes');
	});
});

describe('toDatabaseCards', () => {
	it('maps forward and reverse schedules onto their respective fields', () => {
		const [dbCard] = toDatabaseCards(serviceCards);

		expect(dbCard).toMatchObject({
			front: 'Bonjour',
			repCount: 3,
			easiness: 2.7,
			interval: 16,
			reverseRepCount: 2,
			reverseEasiness: 2.4,
			reverseInterval: 6,
			reverseGrade: Grade.CORRECT_WITH_HESITATION
		});
	});

	it('omits reverse fields entirely when the card has only a forward schedule', () => {
		const [dbCard] = toDatabaseCards([
			{ ...serviceCards[0], schedules: [serviceCards[0].schedules[0]] }
		]);

		// Must be absent, not undefined-valued: key presence is what drives the export guard.
		expect(dbCard).not.toHaveProperty('reverseEasiness');
		expect(dbCard).not.toHaveProperty('reverseLastSeen');
		expect(dbCard.repCount).toBe(3);
	});

	it('falls back to initial SM-2 state when a card has no schedules', () => {
		const [dbCard] = toDatabaseCards([{ ...serviceCards[0], schedules: [] }]);

		expect(dbCard).toMatchObject({ repCount: 0, easiness: 2.5, interval: 1, grade: null });
		expect(dbCard.lastSeen).toBeNull();
		expect(dbCard).not.toHaveProperty('reverseEasiness');
	});

	it('finds the forward schedule regardless of array order', () => {
		const reversedOrder = [serviceCards[0].schedules[1], serviceCards[0].schedules[0]];
		const [dbCard] = toDatabaseCards([{ ...serviceCards[0], schedules: reversedOrder }]);

		expect(dbCard.easiness).toBe(2.7);
		expect(dbCard.reverseEasiness).toBe(2.4);
	});

	it('survives a full service -> export -> import -> database roundtrip', () => {
		const yaml = exportCardsToYaml(toDatabaseCards(serviceCards), metadata, true);
		const { valid, invalid } = importCardsFromYaml(yaml);
		const [dbCard] = convertYamlCardsToDatabaseFormat(valid, 99);

		expect(invalid).toHaveLength(0);
		expect(dbCard).toMatchObject({
			deckId: 99,
			repCount: 3,
			easiness: 2.7,
			interval: 16,
			reverseGrade: Grade.CORRECT_WITH_HESITATION,
			reverseRepCount: 2,
			reverseEasiness: 2.4,
			reverseInterval: 6
		});
	});
});

describe('importCardsFromYaml validation', () => {
	it('separates valid cards from invalid ones with error messages', () => {
		const yaml = `
- Front: Good
  Back: Card
  Priority: A
- Back: Missing front
  Priority: B
`;
		const { valid, invalid } = importCardsFromYaml(yaml);

		expect(valid).toHaveLength(1);
		expect(valid[0].Front).toBe('Good');
		expect(invalid).toHaveLength(1);
		expect(invalid[0].error).toContain('Card at index 1');
	});

	it('accepts an easiness above the 2.5 starting value (no upper cap)', () => {
		const yaml = `
- Front: Practiced
  Back: Card
  Priority: A
  Easiness: 3.2
`;
		const { valid, invalid } = importCardsFromYaml(yaml);

		expect(invalid).toHaveLength(0);
		expect(valid[0].Easiness).toBe(3.2);
	});

	it('throws when the YAML is not an array of cards', () => {
		expect(() => importCardsFromYaml('front: not-an-array')).toThrow(/array of cards/);
	});

	it('throws on malformed YAML', () => {
		expect(() => importCardsFromYaml('::: not : valid : yaml :::')).toThrow(/Error parsing YAML/);
	});
});

describe('convertYamlCardsToDatabaseFormat', () => {
	it('injects deckId, converts LastSeen to a Date, and handles nulls', () => {
		const { valid } = importCardsFromYaml(exportCardsToYaml(sampleCards, undefined, true));
		const dbCards = convertYamlCardsToDatabaseFormat(valid, 42);

		expect(dbCards).toHaveLength(2);
		expect(dbCards[0].deckId).toBe(42);
		expect(dbCards[0].front).toBe('Bonjour');
		expect(dbCards[0].lastSeen).toBeInstanceOf(Date);
		expect(dbCards[1].lastSeen).toBeNull();
	});

	it('preserves reverse-schedule fields when present', () => {
		const yaml = `
- Front: Bonjour
  Back: Hello
  Priority: A
  ReverseLastSeen: 2024-02-01
  ReverseGrade: CORRECT_WITH_HESITATION
  ReverseRepCount: 2
  ReverseEasiness: 2.4
  ReverseInterval: 6
`;
		const { valid } = importCardsFromYaml(yaml);
		const [dbCard] = convertYamlCardsToDatabaseFormat(valid, 7);

		expect(dbCard).toMatchObject({
			deckId: 7,
			reverseLastSeen: expect.any(Date),
			reverseGrade: Grade.CORRECT_WITH_HESITATION,
			reverseRepCount: 2,
			reverseEasiness: 2.4,
			reverseInterval: 6
		});
	});

	it('adds no reverse fields when the YAML has no Reverse* keys', () => {
		const { valid } = importCardsFromYaml(exportCardsToYaml(sampleCards, undefined, true));
		const [dbCard] = convertYamlCardsToDatabaseFormat(valid, 7);

		// Absence must survive validation — the import service uses key presence to decide whether to
		// create a reverse Schedule row.
		expect(dbCard).not.toHaveProperty('reverseEasiness');
		expect(dbCard).not.toHaveProperty('reverseRepCount');
	});

	it('resolves defaults for reverse fields the YAML only partly specifies', () => {
		const yaml = `
- Front: Bonjour
  Back: Hello
  Priority: A
  ReverseRepCount: 4
`;
		const { valid } = importCardsFromYaml(yaml);
		const [dbCard] = convertYamlCardsToDatabaseFormat(valid, 7);

		expect(dbCard).toMatchObject({
			reverseRepCount: 4,
			reverseEasiness: 2.5,
			reverseInterval: 1,
			reverseGrade: null
		});
	});
});
