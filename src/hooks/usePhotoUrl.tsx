import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/** Turns a stored report-photos path into a temporary viewable URL. */
export function usePhotoUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(path ? (cache.get(path) ?? null) : null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    supabase.storage
      .from("report-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!active || !data?.signedUrl) return;
        cache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}

export function PhotoImg({
  path,
  alt,
  className = "",
}: {
  path?: string | null;
  alt: string;
  className?: string;
}) {
  const url = usePhotoUrl(path);
  if (!url) {
    return (
      <div
        className={`grid place-items-center bg-muted text-[9px] font-medium tracking-[0.15em] text-muted-foreground uppercase ${className}`}
      >
        Photo
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}
