"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Novel } from "@/types";

export function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const handleCopy = () => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<button
			type="button"
			onClick={handleCopy}
			className="btn-ghost"
			style={{
				display: "flex",
				alignItems: "center",
				gap: 6,
				fontSize: 12,
				padding: "6px 12px",
			}}
		>
			{copied ? (
				<>
					<Check size={12} style={{ color: "var(--sage)" }} /> Copied!
				</>
			) : (
				<>
					<Copy size={12} /> Copy
				</>
			)}
		</button>
	);
}

export function PromptBox({
	prompt,
	label,
}: { prompt: string; label?: string }) {
	return (
		<div style={{ marginBottom: 16 }}>
			{label && (
				<div
					style={{
						fontSize: 11,
						letterSpacing: "0.07em",
						textTransform: "uppercase",
						color: "var(--ink-soft)",
						marginBottom: 6,
					}}
				>
					{label}
				</div>
			)}
			<div style={{ position: "relative" }}>
				<pre
					style={{
						background: "var(--parchment)",
						border: "1px solid var(--border)",
						padding: "14px 16px",
						fontSize: 12,
						lineHeight: 1.7,
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						margin: 0,
						maxHeight: 300,
						overflow: "auto",
						fontFamily: "DM Sans, sans-serif",
					}}
				>
					{prompt}
				</pre>
				<div style={{ position: "absolute", top: 8, right: 8 }}>
					<CopyButton text={prompt} />
				</div>
			</div>
		</div>
	);
}

export function SaveResultBox({
	novel,
	selectedPartId,
	selectedDQId,
}: {
	novel: Novel;
	selectedPartId: string;
	selectedDQId: string;
}) {
	const { updateDQ, updateCharacter } = useStore();
	const [tab, setTab] = useState<"composition" | "charInfo" | "charPrompt">(
		"composition",
	);
	const [value, setValue] = useState("");
	const [charName, setCharName] = useState(novel.characters[0]?.name ?? "");
	const [saved, setSaved] = useState(false);

	const handleSave = () => {
		if (!value.trim()) return;
		if (tab === "composition" && selectedPartId && selectedDQId) {
			updateDQ(novel.id, selectedPartId, selectedDQId, {
				compositionPrompt: value.trim(),
			});
		} else if (tab === "charPrompt") {
			const char = novel.characters.find((c) => c.name === charName);
			if (char)
				updateCharacter(novel.id, char.id, { textPrompt: value.trim() });
		} else if (tab === "charInfo") {
			const char = novel.characters.find((c) => c.name === charName);
			if (char) updateCharacter(novel.id, char.id, { info: value.trim() });
		}
		setSaved(true);
		setTimeout(() => {
			setSaved(false);
			setValue("");
		}, 1500);
	};

	return (
		<div
			style={{
				marginTop: 20,
				padding: 16,
				background: "var(--parchment)",
				border: "1px solid var(--border)",
			}}
		>
			<div
				style={{
					fontSize: 11,
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: "var(--ink-soft)",
					marginBottom: 10,
				}}
			>
				Gemini 결과 저장하기
			</div>
			<div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
				{(["composition", "charInfo", "charPrompt"] as const).map((t) => (
					<button
						type="button"
						key={t}
						onClick={() => setTab(t)}
						style={{
							padding: "4px 10px",
							fontSize: 11,
							cursor: "pointer",
							background: tab === t ? "var(--ink)" : "white",
							color: tab === t ? "var(--parchment)" : "var(--ink-soft)",
							border: "1px solid",
							borderColor: tab === t ? "var(--ink)" : "var(--border)",
						}}
					>
						{t === "composition"
							? "구도 프롬프트"
							: t === "charInfo"
								? "캐릭터 정보"
								: "캐릭터 텍스트 프롬프트"}
					</button>
				))}
			</div>
			{(tab === "charInfo" || tab === "charPrompt") &&
				novel.characters.length > 0 && (
					<select
						value={charName}
						onChange={(e) => setCharName(e.target.value)}
						className="input-field"
						style={{ fontSize: 12, marginBottom: 8 }}
					>
						{novel.characters.map((c) => (
							<option key={c.id} value={c.name}>
								{c.name}
							</option>
						))}
					</select>
				)}
			<textarea
				className="input-field"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Gemini에서 생성된 결과를 여기에 붙여넣기"
				style={{ fontSize: 12, minHeight: 80, marginBottom: 8 }}
			/>
			<button
				type="button"
				className="btn-primary"
				onClick={handleSave}
				disabled={!value.trim()}
				style={{
					fontSize: 12,
					padding: "7px 16px",
					display: "flex",
					alignItems: "center",
					gap: 6,
				}}
			>
				{saved ? (
					<>
						<Check size={12} /> Saved!
					</>
				) : (
					"저장"
				)}
			</button>
		</div>
	);
}
