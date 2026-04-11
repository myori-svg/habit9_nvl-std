"use client";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Novel } from "@/types";

interface Props {
	novel: Novel;
}

type ActiveStep =
	| "dq"
	| "composition"
	| "char-info"
	| "char-prompt"
	| "char-image"
	| "scene";

const STEPS = [
	{ id: "dq", label: "① DQ 생성", desc: "Discussion Question 생성 프롬프트" },
	{
		id: "composition",
		label: "② 구도 프롬프트",
		desc: "장면 구도 생성 프롬프트",
	},
	{ id: "char-info", label: "③ 캐릭터 관리", desc: "캐릭터 추출 / 정보 수집" },
	{
		id: "char-prompt",
		label: "④ 캐릭터 프롬프트",
		desc: "이미지 생성용 텍스트 프롬프트 작성",
	},
	{ id: "char-image", label: "⑤ 캐릭터 이미지", desc: "캐릭터 이미지 업로드" },
	{
		id: "scene",
		label: "⑥ 장면 생성",
		desc: "최종 장면 이미지 생성 프롬프트 조립",
	},
] as const;

function CopyButton({ text }: { text: string }) {
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

function PromptBox({ prompt, label }: { prompt: string; label?: string }) {
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

function SaveResultBox({
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

export default function ManualPanel({ novel }: Props) {
	const [activeStep, setActiveStep] = useState<ActiveStep>("dq");

	// ── Step 1: DQ
	const [dqChapters, setDqChapters] = useState<string[]>([]);
	const [dqCustomSummary, setDqCustomSummary] = useState("");

	// ── Step 2: Composition
	const [compPartId, setCompPartId] = useState(novel.parts[0]?.id ?? "");
	const [compCustomDQ, setCompCustomDQ] = useState("");

	// ── Step 3: Char Info
	const [charSubStep, setCharSubStep] = useState<"extract" | "info">("extract");
	const [charExtractInput, setCharExtractInput] = useState("");
	const [extractedChars, setExtractedChars] = useState<string[]>([]);
	const [charInfoNames, setCharInfoNames] = useState<string[]>([]);

	// ── Step 4: Char Prompt
	const [charPromptName, setCharPromptName] = useState(
		novel.characters[0]?.name ?? "",
	);
	const [charPromptInfo, setCharPromptInfo] = useState(
		novel.characters[0]?.info ?? "",
	);

	// ── Step 5: Char Image
	const [charImageName, setCharImageName] = useState(
		novel.characters[0]?.name ?? "",
	);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState("");
	const [uploading, setUploading] = useState(false);
	const [uploadDone, setUploadDone] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const { saveCharImage, updateNovel } = useStore();

	// ── Step 6: Scene
	const [scenePartId, setScenePartId] = useState(novel.parts[0]?.id ?? "");
	const [sceneDQId, setSceneDQId] = useState("");
	const [sceneComposition, setSceneComposition] = useState("");
	const [sceneCharIds, setSceneCharIds] = useState<string[]>([]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally resets only on novel switch
	useEffect(() => {
		setActiveStep("dq");
		setDqChapters([]);
		setDqCustomSummary("");
		setCompPartId(novel.parts[0]?.id ?? "");
		setCompCustomDQ("");
		setCharSubStep("extract");
		setCharExtractInput("");
		setExtractedChars([]);
		setCharInfoNames([]);
		setCharPromptName(novel.characters[0]?.name ?? "");
		setCharPromptInfo(novel.characters[0]?.info ?? "");
		setCharImageName(novel.characters[0]?.name ?? "");
		setImageFile(null);
		setImagePreview("");
		setScenePartId(novel.parts[0]?.id ?? "");
		setSceneDQId("");
		setSceneComposition("");
		setSceneCharIds([]);
	}, [novel.id]);

	// ── Computed prompts
	const parsedChapters = (() => {
		if (!novel.summary) return [];
		const lines = novel.summary.split("\n");
		const chapters: { label: string; content: string }[] = [];
		let current: { label: string; lines: string[] } | null = null;
		for (const line of lines) {
			if (/^(chapter|챕터|ch\.?)\s*[\d-]+/i.test(line.trim())) {
				if (current)
					chapters.push({
						label: current.label,
						content: current.lines.join("\n").trim(),
					});
				current = { label: line.trim(), lines: [] };
			} else if (current) {
				current.lines.push(line);
			}
		}
		if (current)
			chapters.push({
				label: current.label,
				content: current.lines.join("\n").trim(),
			});
		return chapters;
	})();

	const selectedSummary =
		parsedChapters.length > 0
			? parsedChapters
					.filter((c) => dqChapters.includes(c.label))
					.map((c) => `${c.label}\n${c.content}`)
					.join("\n\n")
			: dqCustomSummary;

	const dqPrompt = `소설 "${novel.title}"의 챕터별 서머리를 보고 각 챕터에 맞는 Discussion Question을 생성해주세요.

아래 지침을 따라주세요:
- 초등학교 4학년 영어 학습자 수준에 맞게 작성
- 선택형 또는 의견이 갈리는 형식으로 구성 (문제 + 선택지 2~3개)
- 주어진 <예시>를 참고해서 질문을 최대한 흥미롭고 창의적으로 만들어주세요
- 각 챕터당 2-3개 질문
- 영어로 작성
- 각 문제(제목+본문)와 선택지들은 --- 구분선으로 나눌 것
- 서로 다른 문제 간에는 === 구분선으로 나눌 것
- 마크다운 외 다른 태그 없이 코드블럭으로 감싸서 plain text로 반환

<예시>
1. [The Freedom Trade-off] Safety in a Cage vs. Danger in the Wild?
Inside the NIMH lab, the rats have everything: free food, scientists who take care of them, and no predators. But they are trapped in cages. Outside, they can go wherever they want, but they might starve or be hunted
If you were Nicodemus, which life would you choose? Pick one and give 3 reasons:
Option A: The Golden Cage (Safe): "I'll stay in the lab. I get injections that make me smart, I have plenty of food, and I never have to worry about cats or cold weather."
Option B: The Scary Wild (Free): "I'm leaving! I'd rather be hungry and scared but free to make my own choices than be a prisoner in a clean cage."

소설 서머리:
${selectedSummary || "(챕터를 선택하거나 직접 입력해주세요)"}`;

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

	const compositionPrompt = `각 <항목>별로 어울리는 배경화면을 생성할 수 있도록 화풍, 캐릭터 외형을 제외한 장면의 구도를 나타내는 이미지 생성 프롬프트를 생성해줘
각 문제는 === 구분선으로 나누고, 문제 본문과 각 선택지는 --- 구분선으로 구분할 것
답변 반환시에는 동일한 구분선 구조를 유지하고, 각 항목의 시작에는 제목을 붙여서 코드블럭으로 반환할 것
내용에 알맞게 캐릭터들의 구도도 설정하는데, 어떤 캐릭터가 어떤 구도를 잡고 있는지 명시할 것
주어진 내용에서 캐릭터가 느낄만한 표정을 구체적으로 묘사할 것
캐릭터명은 {}으로 감싸고, 어떤 캐릭터들이 등장하는지 각 항목 답변 제일 앞에 모아서 알려줄 것

${questionItems}`;

	const charInfoPrompts = charInfoNames.map((name) => ({
		name,
		prompt: `소설 "${novel.title}"에 등장하는 캐릭터 "${name}"의 정보를 정리해주세요.

아래 내용을 포함해주세요:
- 나이 및 신체적 외형 (머리카락, 눈, 체형, 주로 입는 옷)
- 성격 특징
- 이야기에서의 역할

외형 묘사는 구체적으로. 150단어 이내.`,
	}));

	const styleRef =
		novel.stylePrompt ||
		"cozy heartwarming watercolor and colored pencil storybook illustration, soft hand-drawn outlines, warm golden light, muted pastels and earthy browns, framed by a decorative vine border";

	const charPromptPrompt = `아래 조건에 따라 캐릭터의 외형을 잘 드러나는 이미지 텍스트 프롬프트를 생성해주세요.
- Full-body storybook illustration
- 외형, 의상, 성격이 드러나는 표정과 포즈 묘사
- 성격 정보를 표정에 반영할 것
- 아래 스타일을 따를 것

<image style>
${styleRef}

<character info>
캐릭터명: ${charPromptName || "(이름)"}
${charPromptInfo || "(캐릭터 정보를 입력하세요)"}

프롬프트 텍스트만 출력. 영어로 작성.`;
	const selectedChars = novel.characters.filter((c) =>
		sceneCharIds.includes(c.id),
	);
	const charPromptsText = selectedChars
		.map(
			(c) =>
				`{${c.name}}: ${c.textPrompt || "(텍스트 프롬프트 없음 — ④ 단계에서 생성 필요)"}`,
		)
		.join("\n\n");

	const charImageTextPrompt =
		novel.characters.find((c) => c.name === charImageName)?.textPrompt ?? "";

	const charImagePrompt = `캐릭터 ${charImageName}의 이미지를 생성하기 위한 프롬프트를 작성해주세요.
  - Full-body storybook illustration
  - 스타일은 아래를 참고하고, 캐릭터의 외형과 성격이 잘 드러나도록 묘사해주세요.

<image style>
${styleRef}

<character prompt>
캐릭터명: ${charImageName || "(이름)"}
${charImageTextPrompt || "(④ 단계에서 텍스트 프롬프트를 먼저 생성해주세요)"}

프롬프트 텍스트만 출력. 영어로 작성.`;

	const scenePart = novel.parts.find((p) => p.id === scenePartId);
	const scenePrompt = `아래 지시 사항에 따라 이미지를 생성해주세요.

- 스타일은 <image style>을 따를 것${novel.styleImageBase64 ? " (스타일 참고 이미지도 함께 제공)" : ""}
- 캐릭터는 <character prompt>에 따라 묘사하고, 캐릭터명은 {}로 구분
- 구도는 <composition>을 따를 것
- 표정은 역동적으로
- 이미지 비율: 16:9

<image style>
${styleRef}

<composition>
${sceneComposition || "(구도 프롬프트를 입력하거나 DQ를 선택하세요)"}

<character prompt>
${charPromptsText || "(캐릭터를 선택하세요)"}`;

	const handleImageUpload = async () => {
		if (!imageFile) return;
		setUploading(true);
		try {
			const reader = new FileReader();
			reader.onload = async () => {
				const result = reader.result as string;
				const [header, base64] = result.split(",");
				const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
				const char = novel.characters.find((c) => c.name === charImageName);
				if (char) await saveCharImage(novel.id, char.id, base64, mime);
				setUploadDone(true);
				setTimeout(() => {
					setUploadDone(false);
					setImageFile(null);
					setImagePreview("");
				}, 1500);
			};
			reader.readAsDataURL(imageFile);
		} finally {
			setUploading(false);
		}
	};

	return (
		<div style={{ maxWidth: 800, margin: "0 auto" }}>
			<div style={{ marginBottom: 24 }}>
				<h2
					className="serif"
					style={{ fontSize: 26, fontWeight: 300, margin: "0 0 6px" }}
				>
					Manual Mode — {novel.title}
				</h2>
				<p
					style={{
						fontSize: 13,
						color: "var(--ink-soft)",
						margin: 0,
						opacity: 0.7,
					}}
				>
					각 단계의 프롬프트를 복사해서 Gemini에 직접 붙여넣고, 결과를 다시
					저장할 수 있어요.
				</p>
			</div>

			{/* Step tabs */}
			<div
				style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}
			>
				{STEPS.map((step) => (
					<button
						type="button"
						key={step.id}
						onClick={() => setActiveStep(step.id as ActiveStep)}
						style={{
							padding: "8px 14px",
							cursor: "pointer",
							fontSize: 12,
							fontWeight: 500,
							background: activeStep === step.id ? "var(--ink)" : "white",
							color:
								activeStep === step.id ? "var(--parchment)" : "var(--ink-soft)",
							border: "1px solid",
							borderColor:
								activeStep === step.id ? "var(--ink)" : "var(--border)",
							transition: "all 0.15s",
						}}
					>
						{step.label}
					</button>
				))}
			</div>

			<div
				style={{
					padding: "10px 14px",
					background: "rgba(201,168,76,0.08)",
					border: "1px solid rgba(201,168,76,0.2)",
					marginBottom: 20,
					fontSize: 12,
					color: "var(--ink-soft)",
				}}
			>
				{STEPS.find((s) => s.id === activeStep)?.desc}
			</div>

			<div className="card" style={{ padding: 24 }}>
				{/* ── Step 1: DQ ── */}
				{activeStep === "dq" && (
					<div>
						{parsedChapters.length > 0 ? (
							<div style={{ marginBottom: 16 }}>
								<div
									style={{
										fontSize: 11,
										color: "var(--ink-soft)",
										marginBottom: 8,
										letterSpacing: "0.07em",
										textTransform: "uppercase",
									}}
								>
									챕터 선택 (복수 선택 가능)
								</div>
								<div
									style={{
										display: "flex",
										flexWrap: "wrap",
										gap: 6,
										marginBottom: 12,
									}}
								>
									{parsedChapters.map((c) => {
										const sel = dqChapters.includes(c.label);
										return (
											// biome-ignore lint/a11y/noStaticElementInteractions: internal tool
											// biome-ignore lint/a11y/useKeyWithClickEvents: internal tool
											<div
												key={c.label}
												onClick={() =>
													setDqChapters((prev) =>
														sel
															? prev.filter((x) => x !== c.label)
															: [...prev, c.label],
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
													transition: "all 0.15s",
												}}
											>
												{sel && (
													<Check size={10} style={{ color: "var(--gold)" }} />
												)}
												{c.label}
											</div>
										);
									})}
								</div>
								{dqChapters.length > 0 && (
									<div
										style={{
											padding: "10px 12px",
											background: "var(--parchment)",
											border: "1px solid var(--border)",
											fontSize: 12,
											color: "var(--ink-soft)",
											maxHeight: 120,
											overflow: "auto",
										}}
									>
										<pre
											style={{
												margin: 0,
												whiteSpace: "pre-wrap",
												fontFamily: "DM Sans, sans-serif",
												fontSize: 12,
											}}
										>
											{selectedSummary}
										</pre>
									</div>
								)}
							</div>
						) : (
							<div style={{ marginBottom: 16 }}>
								<div
									style={{
										fontSize: 11,
										color: "var(--ink-soft)",
										marginBottom: 6,
									}}
								>
									챕터가 자동 감지되지 않았어요. 직접 입력하세요:
								</div>
								<textarea
									className="input-field"
									value={dqCustomSummary}
									onChange={(e) => setDqCustomSummary(e.target.value)}
									placeholder="사용할 챕터 서머리를 붙여넣기"
									style={{ fontSize: 12, minHeight: 100 }}
								/>
							</div>
						)}
						<PromptBox prompt={dqPrompt} label="Gemini에 붙여넣을 프롬프트" />
					</div>
				)}

				{/* ── Step 2: Composition ── */}
				{activeStep === "composition" && (
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
				)}

				{/* ── Step 3: Char Info ── */}
				{activeStep === "char-info" && (
					<div>
						<div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
							{(["extract", "info"] as const).map((t) => (
								<button
									type="button"
									key={t}
									onClick={() => setCharSubStep(t)}
									style={{
										padding: "6px 14px",
										cursor: "pointer",
										fontSize: 12,
										background: charSubStep === t ? "var(--gold)" : "white",
										color: charSubStep === t ? "var(--ink)" : "var(--ink-soft)",
										border: "1px solid",
										borderColor:
											charSubStep === t ? "var(--gold)" : "var(--border)",
										transition: "all 0.15s",
									}}
								>
									{t === "extract" ? "③-0 캐릭터 목록 추출" : "③-1 캐릭터 정보"}
								</button>
							))}
						</div>

						{/* ③-0 */}
						{charSubStep === "extract" && (
							<div>
								<div
									style={{
										fontSize: 11,
										color: "var(--ink-soft)",
										marginBottom: 6,
										letterSpacing: "0.07em",
										textTransform: "uppercase",
									}}
								>
									구도 프롬프트 붙여넣기
								</div>
								<textarea
									className="input-field"
									value={charExtractInput}
									onChange={(e) => {
										setCharExtractInput(e.target.value);
										const matches =
											e.target.value
												.match(/\{([^}]+)\}/g)
												?.map((m) => m.slice(1, -1)) ?? [];
										const unique = matches.filter(
											(name, idx) => matches.indexOf(name) === idx,
										);
										setExtractedChars(unique);
									}}
									placeholder="② 단계에서 생성한 구도 프롬프트를 붙여넣으세요"
									style={{ fontSize: 12, minHeight: 120, marginBottom: 12 }}
								/>

								{extractedChars.length > 0 && (
									<div style={{ marginBottom: 16 }}>
										<div
											style={{
												fontSize: 11,
												color: "var(--ink-soft)",
												marginBottom: 8,
												letterSpacing: "0.07em",
												textTransform: "uppercase",
											}}
										>
											추출된 캐릭터
										</div>
										<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
											{extractedChars.map((name) => {
												const exists = novel.characters.some(
													(c) => c.name === name,
												);
												return (
													<div
														key={name}
														style={{
															padding: "5px 12px",
															fontSize: 12,
															border: "1px solid",
															borderColor: exists
																? "var(--sage)"
																: "var(--gold)",
															background: exists
																? "rgba(74,103,65,0.08)"
																: "rgba(201,168,76,0.1)",
															display: "flex",
															alignItems: "center",
															gap: 6,
														}}
													>
														{exists ? (
															<Check
																size={10}
																style={{ color: "var(--sage)" }}
															/>
														) : null}
														{name}
														<span style={{ fontSize: 10, opacity: 0.6 }}>
															{exists ? "이미 있음" : "새 캐릭터"}
														</span>
													</div>
												);
											})}
										</div>
									</div>
								)}

								{extractedChars.some(
									(name) => !novel.characters.some((c) => c.name === name),
								) && (
									<button
										type="button"
										className="btn-primary"
										onClick={() => {
											const newChars = extractedChars
												.filter(
													(name) =>
														!novel.characters.some((c) => c.name === name),
												)
												.map((name) => ({
													id: crypto.randomUUID(),
													name,
													info: "",
													textPrompt: "",
													createdAt: new Date().toISOString(),
												}));
											updateNovel(novel.id, {
												characters: [...novel.characters, ...newChars],
											});
										}}
										style={{
											fontSize: 12,
											padding: "7px 16px",
											display: "flex",
											alignItems: "center",
											gap: 6,
										}}
									>
										<Check size={12} /> 새 캐릭터 저장
									</button>
								)}
							</div>
						)}

						{/* ③-1 */}
						{charSubStep === "info" && (
							<div>
								<div
									style={{
										fontSize: 11,
										color: "var(--ink-soft)",
										marginBottom: 8,
										letterSpacing: "0.07em",
										textTransform: "uppercase",
									}}
								>
									캐릭터 선택 (정보 미생성 캐릭터만 선택 가능)
								</div>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 6,
										marginBottom: 16,
									}}
								>
									{novel.characters.length === 0 && (
										<p
											style={{
												fontSize: 12,
												color: "var(--ink-soft)",
												opacity: 0.5,
											}}
										>
											③-0에서 먼저 캐릭터를 추출해주세요
										</p>
									)}
									{novel.characters.map((c) => {
										const hasInfo = !!c.info;
										const selected = charInfoNames.includes(c.name);
										return (
											// biome-ignore lint/a11y/noStaticElementInteractions: internal tool
											// biome-ignore lint/a11y/useKeyWithClickEvents: internal tool
											<div
												key={c.id}
												onClick={() => {
													if (hasInfo) return;
													setCharInfoNames((prev) =>
														selected
															? prev.filter((n) => n !== c.name)
															: [...prev, c.name],
													);
												}}
												style={{
													display: "flex",
													alignItems: "center",
													gap: 10,
													padding: "8px 12px",
													border: "1px solid",
													borderColor: selected
														? "var(--gold)"
														: "var(--border)",
													background: hasInfo
														? "var(--parchment)"
														: selected
															? "rgba(201,168,76,0.08)"
															: "white",
													cursor: hasInfo ? "not-allowed" : "pointer",
													opacity: hasInfo ? 0.5 : 1,
													transition: "all 0.15s",
												}}
											>
												<div
													style={{
														width: 16,
														height: 16,
														border: "1px solid",
														borderColor: selected
															? "var(--gold)"
															: "var(--border)",
														background: selected ? "var(--gold)" : "white",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														flexShrink: 0,
													}}
												>
													{selected && (
														<Check size={10} style={{ color: "var(--ink)" }} />
													)}
												</div>
												<span style={{ fontSize: 13, flex: 1 }}>{c.name}</span>
												{hasInfo && (
													<span style={{ fontSize: 10, color: "var(--sage)" }}>
														정보 있음
													</span>
												)}
											</div>
										);
									})}
								</div>
								{charInfoPrompts.length > 0 && (
									<PromptBox
										label="Gemini에 붙여넣을 프롬프트"
										prompt={charInfoPrompts
											.map(({ name, prompt }) => `[${name}]\n${prompt}`)
											.join("\n\n===\n\n")}
									/>
								)}
							</div>
						)}
					</div>
				)}

				{/* ── Step 4: Char Prompt ── */}
				{activeStep === "char-prompt" && (
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
				)}

				{/* ── Step 5: Char Image ── */}
				{activeStep === "char-image" && (
					<div>
						<div
							style={{
								fontSize: 11,
								color: "var(--ink-soft)",
								marginBottom: 8,
								letterSpacing: "0.07em",
								textTransform: "uppercase",
							}}
						>
							캐릭터 선택
						</div>
						{novel.characters.length > 0 ? (
							<select
								value={charImageName}
								onChange={(e) => setCharImageName(e.target.value)}
								className="input-field"
								style={{ fontSize: 12, marginBottom: 16 }}
							>
								{novel.characters.map((c) => (
									<option key={c.id} value={c.name}>
										{c.name} {c.imageUrl ? "✓" : ""}
									</option>
								))}
							</select>
						) : (
							<p
								style={{
									fontSize: 12,
									color: "var(--ink-soft)",
									opacity: 0.5,
									marginBottom: 16,
								}}
							>
								③-0에서 먼저 캐릭터를 추출해주세요
							</p>
						)}

						<input
							ref={fileRef}
							type="file"
							accept="image/*"
							style={{ display: "none" }}
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (!file) return;
								setImageFile(file);
								setImagePreview(URL.createObjectURL(file));
							}}
						/>

						{/* biome-ignore lint/a11y/noStaticElementInteractions: internal tool */}
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: internal tool */}
						<div
							onClick={() => fileRef.current?.click()}
							style={{
								border: "2px dashed var(--border)",
								padding: "24px",
								textAlign: "center",
								cursor: "pointer",
								marginBottom: 12,
								background: "white",
								transition: "border-color 0.2s",
							}}
							onMouseEnter={(e) =>
								(e.currentTarget.style.borderColor = "var(--gold)")
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.borderColor = "var(--border)")
							}
						>
							{imagePreview ? (
								// biome-ignore lint/performance/noImgElement: preview only
								<img
									src={imagePreview}
									alt="preview"
									style={{
										maxHeight: 160,
										maxWidth: "100%",
										objectFit: "contain",
									}}
								/>
							) : (
								<span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
									클릭해서 이미지 선택
								</span>
							)}
						</div>

						<PromptBox
							prompt={charImagePrompt}
							label="Gemini에 붙여넣을 프롬프트"
						/>

						<button
							type="button"
							className="btn-primary"
							onClick={handleImageUpload}
							disabled={
								!imageFile || uploading || novel.characters.length === 0
							}
							style={{
								fontSize: 12,
								padding: "7px 16px",
								display: "flex",
								alignItems: "center",
								gap: 6,
							}}
						>
							{uploadDone ? (
								<>
									<Check size={12} /> 저장됨!
								</>
							) : uploading ? (
								"업로드 중…"
							) : (
								"Firebase에 저장"
							)}
						</button>
					</div>
				)}

				{/* ── Step 6: Scene ── */}
				{activeStep === "scene" && (
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
									onChange={(e) => {
										setSceneDQId(e.target.value);
										const dq = scenePart?.discussionQuestions.find(
											(d) => d.id === e.target.value,
										);
										if (dq?.compositionPrompt)
											setSceneComposition(dq.compositionPrompt);
										if (dq?.compositionPrompt) {
											const matches =
												dq.compositionPrompt
													.match(/\{([^}]+)\}/g)
													?.map((m) => m.slice(1, -1)) ?? [];
											const autoIds = novel.characters
												.filter((c) =>
													matches.some(
														(m) => m.toLowerCase() === c.name.toLowerCase(),
													),
												)
												.map((c) => c.id);
											if (autoIds.length > 0) setSceneCharIds(autoIds);
										}
									}}
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
							onChange={(e) => {
								setSceneComposition(e.target.value);
								const matches =
									e.target.value
										.match(/\{([^}]+)\}/g)
										?.map((m) => m.slice(1, -1)) ?? [];
								const autoIds = novel.characters
									.filter((c) =>
										matches.some(
											(m) => m.toLowerCase() === c.name.toLowerCase(),
										),
									)
									.map((c) => c.id);
								if (autoIds.length > 0) setSceneCharIds(autoIds);
							}}
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
						<SaveResultBox
							novel={novel}
							selectedPartId={scenePartId}
							selectedDQId={sceneDQId}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
