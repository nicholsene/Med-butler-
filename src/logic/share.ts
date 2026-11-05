export type DeliverResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Share sheet when the browser can share files, otherwise a download.
 * Call this straight from a tap. Browsers refuse to share if slow work comes between the tap and this call.
 */
export async function deliverFile(file: File): Promise<DeliverResult> {
  try {
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: file.name });
        return 'shared';
      } catch (err) {
        if ((err as Error).name === 'AbortError') return 'cancelled';
      }
    }
    download(file);
    return 'downloaded';
  } catch (err) {
    console.error(err);
    return 'failed';
  }
}

export const jsonFile = (name: string, text: string) => new File([text], name, { type: 'application/json' });

/** Today's date in her own time zone, for file names. */
export function dayStamp(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
