"use client";
import type { Novel } from "@/types";
import { buildCompositionPrompt } from "@/lib/prompts";
import { PromptBox } from "./shared";

interface Props {
	novel: Novel;
	compPartId: string;
	setCompPartId: React.Dispatch<React.SetStateAction<string>>;
	compCustomDQ: string;
	setCompCustomDQ: React.Dispatch<React.SetStateAction<string>>;
}

export default function CompositionStep({
	novel,
	compPartId,
	setCompPartId,
	compCustomDQ,
	setCompCustomDQ,
}: Props) {
	const compPart = novel.parts.find((p) => p.id === compPartId);
	const questionItems = (() => {
		if (novel.parts.length > 0 && compPart) {
			return compPart.discussionQuestions
				.map((dq) =>
					dq.text
						.split(/\n===\n/)
						.map((q) => q.split(/\n---\n/).join("\n---\n"))
						.join("\n===\n"),
				)
				.join("\n===\n");
		}
		if (compCustomDQ) return compCustomDQ;
		return "(질문을 선택하거나 입력해주세요)";
	})();
	const compositionPrompt = buildCompositionPrompt(questionItems);

	return (
		<div>
			{novel.parts.length > 0 ? (
				<div style={{ marginBottom: 16 }}>
					<select
						value={compPartId}
						onChange={(e) => setCompPartId(e.target.value)}
						className="input-field"
						style={{ flex: 1, fontSize: 12 }}
					>
						{novel.parts.map((p) => (
							<option key={p.id} value={p.id}>
								{p.label}
							</option>
						))}
					</select>
				</div>
			) : (
				<textarea
					className="input-field"
					value={compCustomDQ}
					onChange={(e) => setCompCustomDQ(e.target.value)}
					placeholder="Discussion Question을 입력하세요"
					style={{ fontSize: 12, minHeight: 60, marginBottom: 16 }}
				/>
			)}
			<PromptBox
				prompt={compositionPrompt}
				label="Gemini에 붙여넣을 프롬프트"
			/>
		</div>
	);
}
