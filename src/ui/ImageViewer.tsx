import React, { useEffect, useRef } from 'react';

type Props = {
  nodeViewDom: HTMLElement;
  onClose: () => void;
};

const FIGURE_CONTENT_CLASS = 'enhanced-table-figure-content';
const IMAGE_CLIP_CLASS = 'molm-czi-image-view-body-img-clip';
const IMAGE_CLASS = 'molm-czi-image-view-body-img';

export const ImageViewer: React.FC<Props> = ({ nodeViewDom, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const figureContent = nodeViewDom.getElementsByClassName(
      FIGURE_CONTENT_CLASS
    )[0] as HTMLElement | undefined;
    const imgClip = nodeViewDom.getElementsByClassName(
      IMAGE_CLIP_CLASS
    )[0]?.firstElementChild as HTMLElement | undefined;
    const img = nodeViewDom.getElementsByClassName(IMAGE_CLASS)[0] as
      | HTMLElement
      | undefined;
    const isImageFigure = Boolean(img);
    const tables = Array.from(nodeViewDom.getElementsByTagName('table'));

    if (figureContent) {
      figureContent.style.width = isImageFigure ? '864px' : '100%';
      figureContent.style.maxWidth = 'none';
    }

    nodeViewDom.style.width = isImageFigure ? 'auto' : '100%';
    nodeViewDom.style.maxWidth = isImageFigure ? '1024px' : '100%';

    if (imgClip) {
      imgClip.style.width = 'auto';
      imgClip.style.height = 'auto';
    }

    if (img) {
      img.style.width = '854px';
      img.style.height = 'auto';
    }

    if (!isImageFigure) {
      tables.forEach((table) => {
        table.style.width = '100%';
        table.style.minWidth = '100%';
        table.style.tableLayout = 'fixed';
        table.style.borderCollapse = 'collapse';
        table.style.border = '1px solid #000';

        const cells = Array.from(table.querySelectorAll('td, th'));
        cells.forEach((cell) => {
          const htmlCell = cell as HTMLElement;
          htmlCell.style.border = '1px solid #000';
          htmlCell.style.boxSizing = 'border-box';
          htmlCell.style.color = '#000';
          htmlCell.style.opacity = '1';
        });
      });
    }

    container.appendChild(nodeViewDom);
  }, [nodeViewDom]);

  return (
    <div className="image-viewer-overlay">
      <div
        className="image-viewer-wrapper"
        style={{
          position: 'relative',
          width: '900px',
          height: 'auto',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0px',
            right: '-2px',
            zIndex: 1000,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            fontSize: '10px',
            fontWeight: 600,
          }}
        >
          {'\u2715'}
        </button>

        <div
          className="image-viewer-content"
          ref={containerRef}
          style={{
            width: '900px',
            height: 'auto',
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  );
};
