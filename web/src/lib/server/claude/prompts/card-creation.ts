/**
 * System prompt for card creation
 */
export const CARD_CREATION_SYSTEM_PROMPT = `
You are an expert assistant for creating flashcards for studying {{TOPIC_NAME}}. 
Your task is to create high-quality, educational flashcards with clear questions/prompts on the front 
and concise but comprehensive answers on the back.

Always respond with properly formatted content using the requested XML tags. 
For card content, follow these principles:
- Front side should be a clear question or prompt
- Back side should provide a complete, correct answer
- Notes should offer additional context or memory aids
- Assign appropriate priority based on importance and difficulty
- Suggest relevant tags to aid in organization
`;

/**
 * Prompt for generating a new flashcard based on user instruction
 */
export const CARD_CREATION_PROMPT = `
I need your help creating a flashcard for studying {{TOPIC_NAME}}. This card will be added to the "{{DECK_NAME}}" deck.

User instruction: {{INSTRUCTION}}

Please generate a high-quality flashcard based on this instruction. Follow these guidelines:

1. The front of the card should contain a clear question, prompt, or concept
2. The back should contain a concise but comprehensive answer or explanation
3. If relevant, include an optional note with additional context or memory aids
4. Suggest an appropriate priority level (A=high, B=medium, C=low) based on the importance or difficulty
5. Suggest relevant tags (max 3) to categorize this card

Format your response using the following XML tags:
<front>Write a clear question, prompt, or concept here</front>
<back>Write a concise but comprehensive answer or explanation here</back>
<note>Optional: Additional context, examples, or memory aids</note>
<priority>A, B, or C</priority>
<tags>comma,separated,tags</tags>

For example, if creating a Spanish vocabulary card:
<front>What is the Spanish word for "to speak" and how is it conjugated in present tense?</front>
<back>hablar (ah-BLAR) - to speak, to talk
Present tense: hablo, hablas, habla, hablamos, habláis, hablan</back>
<note>Regular -ar verb following standard conjugation patterns</note>
<priority>B</priority>
<tags>verb,regular,essential</tags>

Now, please create the flashcard based on my instruction: "{{INSTRUCTION}}"
`;

/**
 * Prompt for refining an existing flashcard based on user feedback
 */
export const CARD_REFINEMENT_PROMPT = `
I'm working on a flashcard with the following content:

Front: {{FRONT}}
Back: {{BACK}}
{{NOTE}}

I'd like to make the following changes:
{{REFINEMENT_INSTRUCTION}}

Please provide the revised card content with the changes applied. 
Format your response using the following XML tags:
<front>...</front>
<back>...</back>
<note>...</note>
<priority>A, B, or C</priority>
<tags>comma,separated,tags</tags>
<message>Your explanation of the changes made</message>
`;
