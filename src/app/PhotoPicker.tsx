"use client";

// "Add photo" / "Change photo" for the card, used when a photo can't be taken from the document
// (e.g. card photos, where the holder's picture can't be located reliably). Read locally only.
export default function PhotoPicker({ hasPhoto, onPhoto }: { hasPhoto: boolean; onPhoto: (dataUrl: string) => void }) {
  return (
    <label className="block cursor-pointer text-center text-sm text-neutral-500 underline">
      {hasPhoto ? "Change photo" : "Add your photo for the card"}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onPhoto(String(reader.result));
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}
