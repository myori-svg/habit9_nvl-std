"use client";
import { Check } from "lucide-react";
import type { Novel } from "@/types";
import { buildScenePrompt, extractCharNames, getStyleRef } from "@/lib/prompts";
import { PromptBox } from "./shared";

interface Props {
	novel: Novel;
	scenePartId: string;
	setScenePartId: React.Dispatch<React.SetStateAction<string>>;
	sceneDQId: string;
	setSceneDQId: React.Dispatch<React.SetStateAction<string>>;
	sceneComposition: string;
	setSceneComposition: React.Dispatch<React.SetStateAction<string>>;
	sceneCharIds: string[];
	setSceneCharIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function SceneStep({
	novel,
	scenePartId,
	setScenePartId,
	sceneDQId,
	setSceneDQId,
	sceneComposition,
	setSceneComposition,
	sceneCharIds,
	setSceneCharIds,
}: Props) {
	const scenePart = novel.parts.find((p) => p.id === scenePartId);
	const selectedChars = novel.characters.filter((c) =>
		sceneCharIds.includes(c.id),
	);
	const charPromptsText = selectedChars
		.map(
			(c) =>
				`{${c.name}}: ${c.textPrompt || "(텍스트 프롬프트 없음 — ④ 단계에서 생성 필요)"}`,
		)
		.join("\n\n");
	const scenePrompt = buildScenePrompt(
		getStyleRef(novel.stylePrompt),
		!!novel.styleImageBase64,
		sceneComposition,
		charPromptsText,
	);

	const handleDQChange = (dqId: string) => {
		setSceneDQId(dqId);
		const dq = scenePart?.discussionQuestions.find((d) => d.id === dqId);
		if (dq?.compositionPrompt) {
			setSceneComposition(dq.compositionPrompt);
			const autoIds = novel.characters
				.filter((c) =>
					extractCharNames(dq.compositionPrompt).some(
						(m) => m.toLowerCase() === c.name.toLowerCase(),
					),
				)
				.map((c) => c.id);
			if (autoIds.length > 0) setSceneCharIds(autoIds);
		}
	};

	const handleCompositionChange = (text: string) => {
		setSceneComposition(text);
		const autoIds = novel.characters
			.filter((c) =>
				extractCharNames(text).some(
					(m) => m.toLowerCase() === c.name.toLowerCase(),
				),
			)
			.map((c) => c.id);
		if (autoIds.length > 0) setSceneCharIds(autoIds);
	};

	return (
		<div>
			{novel.parts.length > 0 && (
				<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
					<select
						value={scenePartId}
						onChange={(e) => {
							setScenePartId(e.target.value);
							setSceneDQId("");
							setSceneComposition("");
						}}
						className="input-field"
						style={{ flex: 1, fontSize: 12 }}
					>
						{novel.parts.map((p) => (
							<option key={p.id} value={p.id}>
								{p.label}
							</option>
						))}
					</select>
					<select
						value={sceneDQId}
						onChange={(e) => handleDQChange(e.target.value)}
						className="input-field"
						style={{ flex: 2, fontSize: 12 }}
					>
						<option value="">— DQ 선택 (구도 자동 입력) —</option>
						{scenePart?.discussionQuestions.map((dq, i) => (
							<option key={dq.id} value={dq.id}>
								Q{i + 1}. {dq.text.slice(0, 40)}…
							</option>
						))}
					</select>
				</div>
			)}

			<textarea
				className="input-field"
				value={sceneComposition}
				onChange={(e) => handleCompositionChange(e.target.value)}
				placeholder="구도 프롬프트 (②에서 생성한 결과 붙여넣기, 또는 DQ 선택 시 자동 입력)"
				style={{ fontSize: 12, minHeight: 80, marginBottom: 12 }}
			/>

			{novel.characters.length > 0 && (
				<div style={{ marginBottom: 12 }}>
					<div
						style={{
							fontSize: 11,
							color: "var(--ink-soft)",
							marginBottom: 6,
							letterSpacing: "0.07em",
							textTransform: "uppercase",
						}}
					>
						등장 캐릭터
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
						{novel.characters.map((c) => {
							const sel = sceneCharIds.includes(c.id);
							return (
								// biome-ignore lint/a11y/noStaticElementInteractions: internal tool
								// biome-ignore lint/a11y/useKeyWithClickEvents: internal tool
								<div
									key={c.id}
									onClick={() =>
										setSceneCharIds((prev) =>
											sel
												? prev.filter((x) => x !== c.id)
												: [...prev, c.id],
										)
									}
									style={{
										padding: "5px 12px",
										border: "1px solid",
										cursor: "pointer",
										fontSize: 12,
										borderColor: sel ? "var(--gold)" : "var(--border)",
										background: sel ? "rgba(201,168,76,0.1)" : "white",
										display: "flex",
										alignItems: "center",
										gap: 5,
									}}
								>
									{sel && (
										<Check size={10} style={{ color: "var(--gold)" }} />
									)}
									{c.name}
									{!c.textPrompt && (
										<span
											style={{
												fontSize: 10,
												color: "var(--crimson)",
												opacity: 0.7,
											}}
										>
											프롬프트 없음
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			<PromptBox
				prompt={scenePrompt}
				label="Gemini에 붙여넣을 최종 장면 생성 프롬프트"
			/>
		</div>
	);
}
