import type { RequestHandler } from './$types';
import { requireAuth, handleApiError } from '$lib/server/api-helpers';
import { deckService, cardService } from '$lib/server/services';
import { prisma } from '$lib/server/db';
import { exportCardsToYaml } from '$lib/yaml-utils';

/**
 * GET /api/decks/[id]/export - Export a deck's cards as YAML
 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);
		const deckId = parseInt(event.params.id, 10);

		// Check for includeSm2Params query parameter
		const url = new URL(event.request.url);
		const includeSm2Params = url.searchParams.get('includeSm2Params') === 'true';

		// Get user name for metadata
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { name: true }
		});

		// Get deck to verify ownership and get name
		const deck = await deckService.getDeckById(deckId, userId);
		if (!deck) {
			return new Response('Deck not found', { status: 404 });
		}

		// Get all cards for the deck
		const cards = await cardService.getCards({ userId, deckId });

		// Prepare metadata for export
		const metadata = {
			formatVersion: '1.0',
			deckName: deck.name,
			creatorName: user?.name || null,
			exportDate: new Date().toISOString().split('T')[0],
			cardCount: cards.length
		};

		// Convert to YAML with metadata
		const yamlContent = exportCardsToYaml(cards, metadata, includeSm2Params);

		// Create filename
		const filename = `${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_cards.yaml`;

		return new Response(yamlContent, {
			status: 200,
			headers: {
				'Content-Type': 'text/yaml',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (err) {
		return handleApiError(err, { operation: 'export_deck' });
	}
};
