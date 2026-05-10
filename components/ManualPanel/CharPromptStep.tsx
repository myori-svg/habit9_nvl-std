"use client";
import type { Novel } from "@/types";
import { buildCharPromptPrompt, getStyleRef } from "@/lib/prompts";
import { PromptBox } from "./shared";

interface Props {
	novel: Novel;
	charPromptName: string;
	setCharPromptName: React.Dispatch<React.SetStateAction<string>>;
	charPromptInfo: string;
	setCharPromptInfo: React.Dispatch<React.SetStateAction<string>>;
}

export default function CharPromptStep({
	novel,
	charPromptName,
	setCharPromptName,
	charPromptInfo,
	setCharPromptInfo,
}: Props) {
	const charPromptPrompt = buildCharPromptPrompt(
		getStyleRef(novel.stylePrompt),
		charPromptName,
		charPromptInfo,
	);

	return (
		<div>
			<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
				{novel.characters.length > 0 ? (
					<select
						value={charPromptName}
						onChange={(e) => {
							setCharPromptName(e.target.value);
							const c = novel.characters.find(
								(ch) => ch.name === e.target.value,
							);
							setCharPromptInfo(c?.info ?? "");
						}}
						className="input-field"
						style={{ fontSize: 12, flex: 1 }}
					>
						{novel.characters.map((c) => (
							<option key={c.id} value={c.name}>
								{c.name}
							</option>
						))}
					</select>
				) : (
					<input
						className="input-field"
						value={charPromptName}
						onChange={(e) => setCharPromptName(e.target.value)}
						placeholder="캐릭터 이름"
						style={{ fontSize: 12, flex: 1 }}
					/>
				)}
			</div>
			<textarea
				className="input-field"
				value={charPromptInfo}
				onChange={(e) => setCharPromptInfo(e.target.value)}
				placeholder="캐릭터 정보 (③에서 Gemini가 생성한 결과 붙여넣기)"
				style={{ fontSize: 12, minHeight: 80, marginBottom: 12 }}
			/>
			<PromptBox
				prompt={charPromptPrompt}
				label="Gemini에 붙여넣을 프롬프트"
			/>
		</div>
	);
}
