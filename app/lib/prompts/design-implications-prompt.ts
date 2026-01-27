/**
 * Design Implications Prompt Template
 *
 * This file contains the prompt template that is sent to the AI when users
 * navigate to the design page. The design implications from the meeting
 * are automatically inserted into this prompt.
 *
 * ============================================================
 * TO CUSTOMIZE THE PROMPT:
 * Modify the `buildDesignPrompt` function below to change what
 * the AI receives when starting the design phase.
 * ============================================================
 */

export interface DesignImplication {
  id: string;
  text: string;
  category: 'decision' | 'action' | 'discussion' | 'question';
}

/**
 * Builds the prompt that will be sent to the AI to generate a demo site
 * based on the design implications from the meeting.
 *
 * @param implications - Array of design implications from the meeting
 * @param roomId - The room ID for context
 * @returns The formatted prompt string
 */
export function buildDesignPrompt(implications: DesignImplication[], roomId?: string): string {
  // Group implications by category
  const decisions = implications.filter(i => i.category === 'decision');
  const actions = implications.filter(i => i.category === 'action');
  const discussions = implications.filter(i => i.category === 'discussion');
  const questions = implications.filter(i => i.category === 'question');

  // Build the implications section
  let implicationsText = '';

  if (decisions.length > 0) {
    implicationsText += `\n## Decisions Made\n`;
    decisions.forEach((d, i) => {
      implicationsText += `${i + 1}. ${d.text}\n`;
    });
  }

  if (actions.length > 0) {
    implicationsText += `\n## Action Items\n`;
    actions.forEach((a, i) => {
      implicationsText += `${i + 1}. ${a.text}\n`;
    });
  }

  if (discussions.length > 0) {
    implicationsText += `\n## Design Considerations\n`;
    discussions.forEach((d, i) => {
      implicationsText += `${i + 1}. ${d.text}\n`;
    });
  }

  if (questions.length > 0) {
    implicationsText += `\n## Open Questions to Address\n`;
    questions.forEach((q, i) => {
      implicationsText += `${i + 1}. ${q.text}\n`;
    });
  }

  // ============================================================
  // CUSTOMIZE THE MAIN PROMPT BELOW
  // ============================================================

  // Build prompt with or without implications
  let prompt: string;

  if (implicationsText.trim()) {
    prompt = `
Based on our user research meeting, please create a working demo website that addresses the following design implications:

${implicationsText}

## Requirements:
1. Create a functional, interactive prototype that demonstrates these design decisions
2. Use modern, clean UI/UX principles
3. Make it responsive and accessible
4. Include realistic sample content and data
5. Focus on the core user flows discussed in the meeting

Please implement a complete working demo that we can review and iterate on. Start with the most critical features identified in the decisions and action items above.
`.trim();
  } else {
    prompt = `
Based on our user research meeting, please create a working demo website.

## Requirements:
1. Create a functional, interactive prototype
2. Use modern, clean UI/UX principles
3. Make it responsive and accessible
4. Include realistic sample content and data
5. Focus on core user flows

Please implement a complete working demo that we can review and iterate on.
`.trim();
  }

  return prompt;
}
