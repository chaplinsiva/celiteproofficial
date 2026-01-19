"use client";

import React, { use, useEffect, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft, Upload, Video, Image as ImageIcon, FileArchive,
    Type, Plus, X, Loader2, Save
} from "lucide-react";
import Link from "next/link";

interface ImagePlaceholder {
    key: string;
    label: string;
    aspectRatio: string;
    previewTimestamp?: number;
    referenceImageUrl?: string;
}

interface TextPlaceholder {
    key: string;
    label: string;
    defaultValue: string;
    previewTimestamp?: number;
}

interface Template {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    duration: string;
    aspect_ratio: string;
    preview_url: string;
    thumbnail_url: string;
    source_url: string;
    image_placeholders: ImagePlaceholder[];
    text_placeholders: TextPlaceholder[];
}

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { id } = resolvedParams;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("General");
    const [duration, setDuration] = useState("");
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [previewUrl, setPreviewUrl] = useState("");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");

    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

    const [imagePlaceholders, setImagePlaceholders] = useState<ImagePlaceholder[]>([]);
    const [textPlaceholders, setTextPlaceholders] = useState<TextPlaceholder[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [referenceImageFiles, setReferenceImageFiles] = useState<Record<string, File | null>>({});

    useEffect(() => {
        fetchTemplate();
    }, [id]);

    const fetchTemplate = async () => {
        try {
            const res = await fetch(`/api/admin/templates/${id}`);
            const data = await res.json();
            const t: Template = data.template;

            setTitle(t.title);
            setSlug(t.slug);
            setDescription(t.description || "");
            setCategory(t.category || "General");
            setDuration(t.duration || "");
            setAspectRatio(t.aspect_ratio || "16:9");
            setPreviewUrl(t.preview_url || "");
            setThumbnailUrl(t.thumbnail_url || "");
            setSourceUrl(t.source_url || "");
            setThumbnailPreview(t.thumbnail_url || null);
            setImagePlaceholders(t.image_placeholders || []);
            setTextPlaceholders(t.text_placeholders || []);
        } catch (error) {
            console.error("Error fetching template:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbnailFile(file);
            const reader = new FileReader();
            reader.onload = () => setThumbnailPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const addImagePlaceholder = () => {
        const nextNum = imagePlaceholders.length + 1;
        setImagePlaceholders([
            ...imagePlaceholders,
            { key: `img${nextNum}`, label: `Image ${nextNum}`, aspectRatio: "16:9", referenceImageUrl: "" }
        ]);
    };

    const removeImagePlaceholder = (index: number) => {
        setImagePlaceholders(imagePlaceholders.filter((_, i) => i !== index));
    };

    const updateImagePlaceholder = (index: number, field: keyof ImagePlaceholder, value: string | number) => {
        const updated = [...imagePlaceholders];
        updated[index] = { ...updated[index], [field]: value };
        setImagePlaceholders(updated);
    };

    const addTextPlaceholder = () => {
        const nextNum = textPlaceholders.length + 1;
        setTextPlaceholders([
            ...textPlaceholders,
            { key: `text${nextNum}`, label: `Text ${nextNum}`, defaultValue: "" }
        ]);
    };

    const removeTextPlaceholder = (index: number) => {
        setTextPlaceholders(textPlaceholders.filter((_, i) => i !== index));
    };

    const updateTextPlaceholder = (index: number, field: keyof TextPlaceholder, value: string | number) => {
        const updated = [...textPlaceholders];
        updated[index] = { ...updated[index], [field]: value };
        setTextPlaceholders(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            let newPreviewUrl = previewUrl;
            let newThumbnailUrl = thumbnailUrl;
            let newSourceUrl = sourceUrl;

            // Upload new files if provided
            if (previewFile || thumbnailFile || sourceFile) {
                setUploadProgress("Uploading new files...");
                const formData = new FormData();
                formData.append("slug", slug);
                if (previewFile) formData.append("preview", previewFile);
                if (thumbnailFile) formData.append("thumbnail", thumbnailFile);
                if (sourceFile) formData.append("source", sourceFile);

                const uploadRes = await fetch("/api/admin/upload", {
                    method: "POST",
                    body: formData,
                });
                const uploadData = await uploadRes.json();

                if (uploadData.urls?.preview_url) newPreviewUrl = uploadData.urls.preview_url;
                if (uploadData.urls?.thumbnail_url) newThumbnailUrl = uploadData.urls.thumbnail_url;
                if (uploadData.urls?.source_url) newSourceUrl = uploadData.urls.source_url;
            }

            // Upload reference images for placeholders
            const refUploadKeys = Object.keys(referenceImageFiles).filter(k => referenceImageFiles[k]);
            if (refUploadKeys.length > 0) {
                setUploadProgress("Uploading reference images...");
                for (const key of refUploadKeys) {
                    const file = referenceImageFiles[key];
                    if (!file) continue;

                    const formData = new FormData();
                    formData.append("slug", slug);
                    formData.append("reference", file);
                    formData.append("key", key);

                    const refRes = await fetch("/api/admin/upload", {
                        method: "POST",
                        body: formData,
                    });
                    const refData = await refRes.json();

                    if (refData.urls?.reference_url) {
                        const idx = imagePlaceholders.findIndex(p => p.key === key);
                        if (idx !== -1) {
                            imagePlaceholders[idx].referenceImageUrl = refData.urls.reference_url;
                        }
                    }
                }
            }

            setUploadProgress("Saving changes...");
            const res = await fetch(`/api/admin/templates/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug,
                    title,
                    description,
                    category,
                    duration,
                    aspect_ratio: aspectRatio,
                    preview_url: newPreviewUrl,
                    thumbnail_url: newThumbnailUrl,
                    source_url: newSourceUrl,
                    image_placeholders: imagePlaceholders,
                    text_placeholders: textPlaceholders,
                }),
            });

            if (!res.ok) throw new Error("Failed to update template");

            router.push("/admin");
        } catch (error) {
            console.error("Error:", error);
            alert(`Error: ${error}`);
        } finally {
            setIsSubmitting(false);
            setUploadProgress("");
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Edit Template</h1>
                            <p className="text-xs text-gray-500">{title}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress}</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Changes</>
                        )}
                    </button>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Left Column: Files */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Upload className="w-4 h-4 text-indigo-400" /> File Uploads
                            </h3>

                            <div className="mb-6">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Thumbnail</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleThumbnailChange}
                                    className="hidden"
                                    id="thumbnail-upload"
                                />
                                <label
                                    htmlFor="thumbnail-upload"
                                    className="block aspect-video bg-white/[0.02] border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.04] hover:border-indigo-500/50 transition-all overflow-hidden"
                                >
                                    {thumbnailPreview ? (
                                        <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                            <ImageIcon className="w-8 h-8 text-gray-600" />
                                            <span className="text-xs text-gray-500">Upload Thumbnail</span>
                                        </div>
                                    )}
                                </label>
                            </div>

                            <div className="mb-6">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Video Preview</label>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    id="preview-upload"
                                />
                                <label
                                    htmlFor="preview-upload"
                                    className={`block p-4 bg-white/[0.02] border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all text-center ${previewFile ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                                >
                                    <Video className={`w-6 h-6 mx-auto mb-2 ${previewFile ? 'text-emerald-400' : 'text-gray-600'}`} />
                                    <span className="text-xs text-gray-400">
                                        {previewFile ? previewFile.name : previewUrl ? "Replace Preview" : "Upload Preview"}
                                    </span>
                                </label>
                                {previewUrl && !previewFile && (
                                    <p className="text-[10px] text-gray-600 mt-2 truncate">Current: {previewUrl}</p>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Source ZIP</label>
                                <input
                                    type="file"
                                    accept=".zip"
                                    onChange={(e) => setSourceFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    id="source-upload"
                                />
                                <label
                                    htmlFor="source-upload"
                                    className={`block p-4 bg-white/[0.02] border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all text-center ${sourceFile ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                                >
                                    <FileArchive className={`w-6 h-6 mx-auto mb-2 ${sourceFile ? 'text-emerald-400' : 'text-gray-600'}`} />
                                    <span className="text-xs text-gray-400">
                                        {sourceFile ? sourceFile.name : sourceUrl ? "Replace ZIP" : "Upload ZIP"}
                                    </span>
                                </label>
                                {sourceUrl && !sourceFile && (
                                    <p className="text-[10px] text-gray-600 mt-2 truncate">Current: {sourceUrl}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Template Details</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Title *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Slug</label>
                                    <input
                                        type="text"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
                                    >
                                        <option value="General">General</option>
                                        <option value="Logo Stings">Logo Stings</option>
                                        <option value="Promos">Promos</option>
                                        <option value="Social Media">Social Media</option>
                                        <option value="Corporate">Corporate</option>
                                        <option value="Titles">Titles</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Duration</label>
                                    <input
                                        type="text"
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Aspect Ratio</label>
                                    <select
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
                                    >
                                        <option value="16:9">16:9</option>
                                        <option value="9:16">9:16</option>
                                        <option value="1:1">1:1</option>
                                        <option value="4:3">4:3</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Image Placeholders */}
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-purple-400" /> Image Placeholders
                                </h3>
                                <button
                                    type="button"
                                    onClick={addImagePlaceholder}
                                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                >
                                    <Plus className="w-3 h-3" /> Add
                                </button>
                            </div>

                            <div className="space-y-4">
                                {imagePlaceholders.map((placeholder, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl"
                                    >
                                        <div className="flex-1 grid grid-cols-5 gap-3">
                                            <input
                                                type="text"
                                                value={placeholder.key}
                                                onChange={(e) => updateImagePlaceholder(index, "key", e.target.value)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                                placeholder="Key"
                                            />
                                            <input
                                                type="text"
                                                value={placeholder.label}
                                                onChange={(e) => updateImagePlaceholder(index, "label", e.target.value)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                                placeholder="Label"
                                            />
                                            <input
                                                type="text"
                                                value={placeholder.aspectRatio}
                                                onChange={(e) => updateImagePlaceholder(index, "aspectRatio", e.target.value)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                                placeholder="1920x1080"
                                            />
                                            <input
                                                type="number"
                                                value={placeholder.previewTimestamp || ""}
                                                onChange={(e) => updateImagePlaceholder(index, "previewTimestamp", e.target.value ? parseFloat(e.target.value) : 0)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                                placeholder="Sec"
                                                step="0.1"
                                            />
                                            {/* Reference Image Upload */}
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    id={`ref-${placeholder.key}`}
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setReferenceImageFiles(prev => ({ ...prev, [placeholder.key]: file }));
                                                        }
                                                    }}
                                                />
                                                <label
                                                    htmlFor={`ref-${placeholder.key}`}
                                                    className="flex items-center justify-center h-full w-full bg-white/[0.03] border border-dashed border-white/10 rounded-lg text-xs text-gray-500 hover:border-indigo-500/50 hover:text-indigo-400 cursor-pointer transition-all overflow-hidden"
                                                >
                                                    {referenceImageFiles[placeholder.key] ? (
                                                        <span className="text-emerald-400 truncate px-1">{referenceImageFiles[placeholder.key]?.name.slice(0, 8)}...</span>
                                                    ) : placeholder.referenceImageUrl ? (
                                                        <img src={placeholder.referenceImageUrl} alt="Ref" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>Ref Img</span>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeImagePlaceholder(index)}
                                            className="p-2 text-gray-500 hover:text-red-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Text Placeholders */}
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Type className="w-4 h-4 text-emerald-400" /> Text Placeholders
                                </h3>
                                <button
                                    type="button"
                                    onClick={addTextPlaceholder}
                                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                >
                                    <Plus className="w-3 h-3" /> Add
                                </button>
                            </div>

                            <div className="space-y-4">
                                {textPlaceholders.map((placeholder, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl"
                                    >
                                        <div className="flex-1 grid grid-cols-4 gap-3">
                                            <input
                                                type="text"
                                                value={placeholder.key}
                                                onChange={(e) => updateTextPlaceholder(index, "key", e.target.value)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={placeholder.label}
                                                onChange={(e) => updateTextPlaceholder(index, "label", e.target.value)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={placeholder.defaultValue}
                                                onChange={(e) => updateTextPlaceholder(index, "defaultValue", e.target.value)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                                placeholder="Default"
                                            />
                                            <input
                                                type="number"
                                                value={placeholder.previewTimestamp || ""}
                                                onChange={(e) => updateTextPlaceholder(index, "previewTimestamp", e.target.value ? parseFloat(e.target.value) : 0)}
                                                className="bg-white/[0.03] border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                                                placeholder="Sec"
                                                step="0.1"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeTextPlaceholder(index)}
                                            className="p-2 text-gray-500 hover:text-red-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </main>
    );
}
