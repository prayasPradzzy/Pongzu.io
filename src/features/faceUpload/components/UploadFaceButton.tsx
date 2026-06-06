import { useRef } from 'react';

type UploadFaceButtonProps = {
  onFileSelected: (file: File) => void;
};

export function UploadFaceButton({ onFileSelected }: UploadFaceButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="face-upload__button"
        onClick={() => inputRef.current?.click()}
      >
        Upload Face
      </button>
      <input
        ref={inputRef}
        className="face-upload__input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onFileSelected(file);
          }

          event.target.value = '';
        }}
      />
    </>
  );
}