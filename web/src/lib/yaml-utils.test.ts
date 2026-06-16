import { describe, it, expect } from 'vitest';
import {
	exportCardsToYaml,
	importCardsFromYaml,
	convertYamlCardsToDatabaseFormat,
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
	cardCount: 2
};

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
});
