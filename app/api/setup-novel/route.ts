import { type NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithRetry,
  getGenAI,
  PERMISSIVE_SAFETY_SETTINGS,
} from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const { title, summary, stylePrompt, styleRefImages } = await req.json();
  const refImages: { base64: string; mime: string }[] = styleRefImages ?? [];
  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured on server' },
      { status: 500 }
    );

  const genAI = getGenAI();
  const textModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    safetySettings: PERMISSIVE_SAFETY_SETTINGS,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // ── Step 1: Generate Discussion Questions ──────────────────────
        send({
          step: 'generating-dq',
          message: 'Generating discussion questions…',
        });

        const dqResult = await generateContentWithRetry(
          textModel,
          `
You are an expert literature teacher creating discussion questions for elementary students (grade 4).

Novel: "${title}"
Full Summary:
${summary}

Task: Parse the summary into chapters/parts (e.g. "Chapter 1-2", "Chapter 3-4").
For each part, create 2-3 engaging discussion questions that:
- Are appropriate for grade 4 English learners
- Include choice-based or opinion questions that spark debate
- Reference specific events from that chapter

Return ONLY valid JSON, no markdown fences:
{
  "parts": [
    {
      "label": "Chapter 1-2",
      "questions": ["Question 1", "Question 2"]
    }
  ]
}
`
        );

        const dqText = dqResult.response
          .text()
          .trim()
          .replace(/```json|```/g, '')
          .trim();
        const dqData = JSON.parse(dqText);

        // ── Step 2: Composition prompts for each DQ ────────────────────
        const totalDQs = dqData.parts.reduce(
          (acc: number, p: { questions: string[] }) => acc + p.questions.length,
          0
        );
        send({
          step: 'generating-composition',
          message: 'Generating scene composition prompts…',
          current: 0,
          total: totalDQs,
        });

        let dqCount = 0;
        const partsWithComposition = [];
        for (const part of dqData.parts) {
          const dqsWithComposition = [];
          for (const q of part.questions) {
            dqCount++;
            send({
              step: 'generating-composition',
              message: `Scene for: "${q.slice(0, 50)}…"`,
              current: dqCount,
              total: totalDQs,
            });

            const compResult = await generateContentWithRetry(
              textModel,
              `
You are an expert at creating visual scene composition prompts for storybook illustration.

Novel: "${title}"
Discussion Question: "${q}"

Create a detailed scene composition prompt describing:
- Setting, atmosphere, time of day, lighting mood
- Camera angle and framing (e.g. medium shot, wide shot)
- Character positions, actions, expressions — wrap character names in {}
- Key props and visual elements
- Emotional tone of the scene

Return ONLY the composition prompt text. No preamble. English only.
`
            );
            dqsWithComposition.push({
              id: crypto.randomUUID(),
              text: q,
              compositionPrompt: compResult.response.text().trim(),
            });
          }
          partsWithComposition.push({
            id: crypto.randomUUID(),
            label: part.label,
            content: '',
            discussionQuestions: dqsWithComposition,
          });
        }

        // ── Step 3: Extract characters ─────────────────────────────────
        send({
          step: 'extracting-characters',
          message: 'Extracting character list…',
        });

        const charListResult = await generateContentWithRetry(
          textModel,
          `
Novel: "${title}"
Summary: ${summary}

List all named characters. Return ONLY valid JSON, no markdown fences:
{"characters": [{"name": "Character Name"}]}
`
        );
        const charListText = charListResult.response
          .text()
          .trim()
          .replace(/```json|```/g, '')
          .trim();
        const charListData = JSON.parse(charListText);

        // ── Step 4: Character info ─────────────────────────────────────
        send({
          step: 'generating-char-info',
          message: 'Gathering character info…',
          current: 0,
          total: charListData.characters.length,
        });

        const charsWithInfo = [];
        for (let ci = 0; ci < charListData.characters.length; ci++) {
          const char = charListData.characters[ci];
          send({
            step: 'generating-char-info',
            message: `Analyzing ${char.name}…`,
            current: ci + 1,
            total: charListData.characters.length,
          });

          const infoResult = await generateContentWithRetry(
            textModel,
            `
Describe the character "${char.name}" from "${title}".
Include: age, physical appearance (hair, eyes, build, clothing), personality traits, story role.
When describing age, avoid stating an exact number (e.g. "13 years old") — use a vague phrase like "a young child" or "elementary-school age" instead, to reduce false-positive safety filter blocks on children's illustration content.
Be specific. Under 150 words.
`
          );
          charsWithInfo.push({
            name: char.name,
            info: infoResult.response.text().trim(),
          });
        }

        // ── Step 5: Character text prompts ────────────────────────────
        send({
          step: 'generating-char-prompts',
          message: 'Writing character prompts…',
          current: 0,
          total: charsWithInfo.length,
        });

        const styleRef =
          stylePrompt ||
          `cozy heartwarming watercolor and colored pencil storybook illustration style, soft hand-drawn outlines, visible pencil strokes, warm golden light, muted pastels and earthy browns, framed by a decorative vine border`;

        const charsWithPrompts = [];
        for (let ci = 0; ci < charsWithInfo.length; ci++) {
          const char = charsWithInfo[ci];
          send({
            step: 'generating-char-prompts',
            message: `Prompt for ${char.name}…`,
            current: ci + 1,
            total: charsWithInfo.length,
          });

          const promptParts: Array<
            | { text: string }
            | { inlineData: { data: string; mimeType: string } }
          > = [];
          for (const img of refImages) {
            promptParts.push({
              inlineData: { data: img.base64, mimeType: img.mime },
            });
          }
          promptParts.push({
            text: `Create a detailed image generation prompt for this character.

Character: ${char.name}
Info: ${char.info}

Requirements:
- Full-body storybook illustration
- Describe appearance, clothing, expression reflecting personality
- Style: ${styleRef}
${refImages.length > 0 ? '- Match the style of the reference images provided' : ''}
- If an exact age is mentioned (e.g. "13 years old"), rephrase it vaguely (e.g. "young", "a child") instead of stating the number — this reduces false-positive safety filter blocks on children's illustration content

Return ONLY the prompt. English only.`,
          });

          const promptResult = await generateContentWithRetry(
            textModel,
            promptParts as never
          );
          charsWithPrompts.push({
            ...char,
            textPrompt: promptResult.response.text().trim(),
          });
        }

        // ── Step 6: Character images ───────────────────────────────────
        send({
          step: 'generating-char-images',
          message: 'Generating character images…',
          current: 0,
          total: charsWithPrompts.length,
        });

        const imageModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash-image',
          safetySettings: PERMISSIVE_SAFETY_SETTINGS,
          generationConfig: {
            // @ts-expect-error responseModalities/imageConfig not yet in SDK types
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: '16:9' },
          },
        });

        const finalCharacters = [];
        for (let ci = 0; ci < charsWithPrompts.length; ci++) {
          const char = charsWithPrompts[ci];
          send({
            step: 'generating-char-images',
            message: `Generating image for ${char.name}…`,
            current: ci + 1,
            total: charsWithPrompts.length,
          });

          try {
            const imgParts: Array<
              | { text: string }
              | { inlineData: { data: string; mimeType: string } }
            > = [];
            for (const img of refImages) {
              imgParts.push({
                inlineData: { data: img.base64, mimeType: img.mime },
              });
            }
            imgParts.push({ text: char.textPrompt });

            const imgResult = await generateContentWithRetry(
              imageModel,
              imgParts as never
            );
            let imageBase64 = '';
            let imageMime = 'image/png';

            for (const part of imgResult.response.candidates?.[0]?.content
              ?.parts ?? []) {
              const p = part as {
                inlineData?: { data: string; mimeType: string };
              };
              if (p.inlineData) {
                imageBase64 = p.inlineData.data;
                imageMime = p.inlineData.mimeType;
                break;
              }
            }

            finalCharacters.push({
              id: crypto.randomUUID(),
              name: char.name,
              info: char.info,
              textPrompt: char.textPrompt,
              imageBase64,
              imageMime,
              createdAt: new Date().toISOString(),
            });
          } catch {
            finalCharacters.push({
              id: crypto.randomUUID(),
              name: char.name,
              info: char.info,
              textPrompt: char.textPrompt,
              imageBase64: '',
              imageMime: 'image/png',
              createdAt: new Date().toISOString(),
            });
          }
        }

        // ── Done ──────────────────────────────────────────────────────
        send({
          step: 'done',
          message: 'Setup complete!',
          result: { parts: partsWithComposition, characters: finalCharacters },
        });
      } catch (e) {
        send({ step: 'error', message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
