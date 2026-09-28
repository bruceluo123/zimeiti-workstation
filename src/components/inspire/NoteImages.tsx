"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { loadInspirationImage } from "@/lib/inspiration-media";

export function NoteImages({ imageIds }: { imageIds?: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    Promise.all((Array.isArray(imageIds) ? imageIds : []).map((id) => loadInspirationImage(id).catch(() => null)))
      .then((loaded) => {
        if (!active) return;
        loaded.forEach((url) => { if (url) objectUrls.push(url); });
        setUrls(objectUrls);
      });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageIds]);

  if (!imageIds?.length) return null;
  if (!urls.length) return <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-surface-2 text-muted"><ImageIcon size={20} /></div>;

  return (
    <div className={`mt-3 grid gap-2 overflow-hidden rounded-xl ${urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {urls.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt={`随笔图片 ${index + 1}`} className={`w-full rounded-xl object-cover ${urls.length === 1 ? "max-h-[420px]" : "aspect-square"}`} />
      ))}
    </div>
  );
}
