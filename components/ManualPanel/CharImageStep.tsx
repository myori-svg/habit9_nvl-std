"use client";
import { Check } from "lucide-react";
import { useRef } from "react";
import { useStore } from "@/lib/store";
import type { Novel } from "@/types";
import { buildCharImagePrompt, getStyleRef } from "@/lib/prompts";
import { PromptBox } from "./shared";

interface Props {
	novel: Novel;
	charImageName: string;
	setCharImageName: React.Dispatch<React.SetStateAction<string>>;
	imageFile: File | null;
	setImageFile: React.Dispatch<React.SetStateAction<File | null>>;
	imagePreview: string;
	setImagePreview: React.Dispatch<React.SetStateAction<string>>;
	uploading: boolean;
	setUploading: React.Dispatch<React.SetStateAction<boolean>>;
	uploadDone: boolean;
	setUploadDone: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function CharImageStep({
	novel,
	charImageName,
	setCharImageName,
	imageFile,
	setImageFile,
	imagePreview,
	setImagePreview,
	uploading,
	setUploading,
	uploadDone,
	setUploadDone,
}: Props) {
	const { saveCharImage } = useStore();
	const fileRef = useRef<HTMLInputElement>(null);

	const charImageTextPrompt =
		novel.characters.find((c) => c.name === charImageName)?.textPrompt ?? "";
	const charImagePrompt = buildCharImagePrompt(
		getStyleRef(novel.stylePrompt),
		charImageName,
		charImageTextPrompt,
	);

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
				disabled={!imageFile || uploading || novel.characters.length === 0}
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
	);
}
