import { useCallback, useState } from 'react';

// 파일을 끌어다 놓는(drag & drop) 영역에 붙이는 핸들러. 클릭으로 파일을
// 고르는 기존 input onChange와 같은 콜백(onFiles)을 공유해서 쓴다.
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return { isDragging, onDragOver, onDragLeave, onDrop };
}
