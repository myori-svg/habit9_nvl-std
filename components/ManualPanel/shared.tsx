"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Novel } from "@/types";

function CopyButton({
	onCopy,
	copied,
}: { onCopy: () => void; copied: boolean }) {
	return (
		<button
			type="button"
			onClick={onCopy}
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
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(prompt);
		setCopied(true);
		setTimeout(() => setCopied(false), 3000);
	};

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
					<CopyButton onCopy={handleCopy} copied={copied} />
				</div>
			</div>

			{copied && (
				<div
					onClick={() => setCopied(false)}
					style={{
						position: "fixed",
						inset: 0,
						zIndex: 200,
						background: "rgba(26,20,16,0.7)",
						backdropFilter: "blur(4px)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						animation: "fadeIn 0.2s ease",
					}}
				>
					<div
						onClick={(e) => e.stopPropagation()}
						style={{
							background: "var(--parchment)",
							border: "1px solid var(--border)",
							padding: "40px 48px",
							maxWidth: 420,
							width: "90%",
							textAlign: "center",
							boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
							animation: "slideUp 0.2s ease",
						}}
					>
						<div
							style={{
								width: 48,
								height: 48,
								borderRadius: "50%",
								background: "rgba(74,103,65,0.12)",
								border: "1px solid var(--sage)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								margin: "0 auto 20px",
							}}
						>
							<Check size={22} style={{ color: "var(--sage)" }} />
						</div>
						<p
							className="serif"
							style={{ fontSize: 22, fontWeight: 300, margin: "0 0 8px" }}
						>
							클립보드에 복사됐어요!
						</p>
						<p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 28px" }}>
							Gemini에 붙여넣고 결과를 받아오세요.
						</p>
						<button
							type="button"
							onClick={() => setCopied(false)}
							className="btn-primary"
							style={{ fontSize: 13, padding: "10px 28px" }}
						>
							확인
						</button>
					</div>
				</div>
			)}
			<style>{`
				@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
				@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
			`}</style>
		</div>
	);
}

const saveBoxStyle = {
	marginTop: 20,
	padding: 16,
	background: "var(--parchment)",
	border: "1px solid var(--border)",
} as const;

const saveLabelStyle = {
	fontSize: 11,
	letterSpacing: "0.08em",
	textTransform: "uppercase" as const,
	color: "var(--ink-soft)",
	marginBottom: 10,
};

function SaveButton({ saved }: { saved: boolean }) {
	return saved ? (
		<>
			<Check size={12} /> Saved!
		</>
	) : (
		<>저장</>
	);
}

// ② 구도 프롬프트 결과 저장
export function SaveCompositionBox({
	novel,
	compPartId,
}: {
	novel: Novel;
	compPartId: string;
}) {
	const { updateDQ } = useStore();
	const [selectedDQId, setSelectedDQId] = useState("");
	const [value, setValue] = useState("");
	const [saved, setSaved] = useState(false);

	const part = novel.parts.find((p) => p.id === compPartId);
	if (!part || part.discussionQuestions.length === 0) return null;

	const handleSave = () => {
		if (!value.trim() || !selectedDQId) return;
		updateDQ(novel.id, compPartId, selectedDQId, {
			compositionPrompt: value.trim(),
		});
		setSaved(true);
		setTimeout(() => {
			setSaved(false);
			setValue("");
		}, 1500);
	};

	return (
		<div style={saveBoxStyle}>
			<div style={saveLabelStyle}>구도 프롬프트 저장</div>
			<select
				value={selectedDQId}
				onChange={(e) => setSelectedDQId(e.target.value)}
				className="input-field"
				style={{ fontSize: 12, marginBottom: 8 }}
			>
				<option value="">— 저장할 DQ 선택 —</option>
				{part.discussionQuestions.map((dq, i) => (
					<option key={dq.id} value={dq.id}>
						Q{i + 1}. {dq.text.slice(0, 50)}…
					</option>
				))}
			</select>
			<textarea
				className="input-field"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Gemini에서 생성된 구도 프롬프트를 붙여넣기"
				style={{ fontSize: 12, minHeight: 80, marginBottom: 8 }}
			/>
			<button
				type="button"
				className="btn-primary"
				onClick={handleSave}
				disabled={!value.trim() || !selectedDQId}
				style={{ fontSize: 12, padding: "7px 16px", display: "flex", alignItems: "center", gap: 6 }}
			>
				<SaveButton saved={saved} />
			</button>
		</div>
	);
}

// ③-1 캐릭터 정보 결과 저장
export function SaveCharInfoBox({ novel }: { novel: Novel }) {
	const { updateCharacter } = useStore();
	const [charName, setCharName] = useState(novel.characters[0]?.name ?? "");
	const [value, setValue] = useState("");
	const [saved, setSaved] = useState(false);

	if (novel.characters.length === 0) return null;

	const handleSave = () => {
		if (!value.trim()) return;
		const char = novel.characters.find((c) => c.name === charName);
		if (char) updateCharacter(novel.id, char.id, { info: value.trim() });
		setSaved(true);
		setTimeout(() => {
			setSaved(false);
			setValue("");
		}, 1500);
	};

	return (
		<div style={saveBoxStyle}>
			<div style={saveLabelStyle}>캐릭터 정보 저장</div>
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
			<textarea
				className="input-field"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Gemini에서 생성된 캐릭터 정보를 붙여넣기"
				style={{ fontSize: 12, minHeight: 80, marginBottom: 8 }}
			/>
			<button
				type="button"
				className="btn-primary"
				onClick={handleSave}
				disabled={!value.trim()}
				style={{ fontSize: 12, padding: "7px 16px", display: "flex", alignItems: "center", gap: 6 }}
			>
				<SaveButton saved={saved} />
			</button>
		</div>
	);
}

// ③-2 캐릭터 프롬프트 결과 저장
export function SaveCharPromptBox({
	novel,
	charName,
}: {
	novel: Novel;
	charName: string;
}) {
	const { updateCharacter } = useStore();
	const [value, setValue] = useState("");
	const [saved, setSaved] = useState(false);

	const handleSave = () => {
		if (!value.trim()) return;
		const char = novel.characters.find((c) => c.name === charName);
		if (char) updateCharacter(novel.id, char.id, { textPrompt: value.trim() });
		setSaved(true);
		setTimeout(() => {
			setSaved(false);
			setValue("");
		}, 1500);
	};

	return (
		<div style={saveBoxStyle}>
			<div style={saveLabelStyle}>캐릭터 프롬프트 저장</div>
			<textarea
				className="input-field"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Gemini에서 생성된 캐릭터 프롬프트를 붙여넣기"
				style={{ fontSize: 12, minHeight: 80, marginBottom: 8 }}
			/>
			<button
				type="button"
				className="btn-primary"
				onClick={handleSave}
				disabled={!value.trim()}
				style={{ fontSize: 12, padding: "7px 16px", display: "flex", alignItems: "center", gap: 6 }}
			>
				<SaveButton saved={saved} />
			</button>
		</div>
	);
}
