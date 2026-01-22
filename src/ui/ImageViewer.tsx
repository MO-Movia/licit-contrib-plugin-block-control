import React, { useEffect, useRef } from 'react';

type Props = {
    nodeViewDom: HTMLElement;
    onClose: () => void;
};

export const ImageViewer: React.FC<Props> = ({
    nodeViewDom,
    onClose,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Mount NodeView DOM inside React
        (nodeViewDom.getElementsByClassName('enhanced-table-figure-content')[0] as HTMLElement).style.width = '864px';
        (nodeViewDom as HTMLElement).style.width = 'auto';
        (nodeViewDom as HTMLElement).style.maxWidth = '1024px';
        (nodeViewDom.getElementsByClassName('molm-czi-image-view-body-img-clip')[0]?.firstElementChild as HTMLElement).style.width = 'auto';
        (nodeViewDom.getElementsByClassName('molm-czi-image-view-body-img-clip')[0]?.firstElementChild as HTMLElement).style.height = 'auto';
        (nodeViewDom.getElementsByClassName('molm-czi-image-view-body-img')[0] as HTMLElement).style.width = '854px';
        (nodeViewDom.getElementsByClassName('molm-czi-image-view-body-img')[0] as HTMLElement).style.height = 'auto';

        container.appendChild(nodeViewDom);
        // eslint-disable-next-line consistent-return
        return () => {
            // Safety cleanup – do nothing here
            // Restoration handled by NodeView
        };
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
                        fontWeight: 600
                    }}
                >
                    ✕
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
        </div >
    );

};
