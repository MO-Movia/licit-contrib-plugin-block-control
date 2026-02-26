import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ImageViewer } from './ImageViewer';

describe('ImageViewer', () => {
  afterEach(() => {
    cleanup();
  });

  it('applies image-specific sizing and mounts node content into viewer container', () => {
    const nodeViewDom = document.createElement('div');

    const figureContent = document.createElement('div');
    figureContent.className = 'enhanced-table-figure-content';
    nodeViewDom.appendChild(figureContent);

    const imgClip = document.createElement('div');
    imgClip.className = 'molm-czi-image-view-body-img-clip';
    const clipInner = document.createElement('div');
    imgClip.appendChild(clipInner);
    nodeViewDom.appendChild(imgClip);

    const img = document.createElement('div');
    img.className = 'molm-czi-image-view-body-img';
    nodeViewDom.appendChild(img);

    const onClose = jest.fn();
    const { container } = render(
      <ImageViewer nodeViewDom={nodeViewDom} onClose={onClose} />
    );

    const viewerContainer = container.querySelector('.image-viewer-content');

    expect(viewerContainer).toBeTruthy();
    expect(viewerContainer?.contains(nodeViewDom)).toBe(true);
    expect(figureContent.style.width).toBe('864px');
    expect(nodeViewDom.style.width).toBe('auto');
    expect(nodeViewDom.style.maxWidth).toBe('1024px');
    expect(clipInner.style.width).toBe('auto');
    expect(clipInner.style.height).toBe('auto');
    expect(img.style.width).toBe('854px');
    expect(img.style.height).toBe('auto');
  });

  it('applies table sizing when image body is not present', () => {
    const nodeViewDom = document.createElement('div');
    const figureContent = document.createElement('div');
    figureContent.className = 'enhanced-table-figure-content';
    nodeViewDom.appendChild(figureContent);

    const table = document.createElement('table');
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    row.appendChild(cell);
    table.appendChild(row);
    nodeViewDom.appendChild(table);

    const onClose = jest.fn();
    const { container } = render(
      <ImageViewer nodeViewDom={nodeViewDom} onClose={onClose} />
    );

    const viewerContainer = container.querySelector('.image-viewer-content');

    expect(viewerContainer?.contains(nodeViewDom)).toBe(true);
    expect(figureContent.style.width).toBe('100%');
    expect(nodeViewDom.style.width).toBe('100%');
    expect(nodeViewDom.style.maxWidth).toBe('100%');
    expect(table.style.width).toBe('100%');
    expect(table.style.minWidth).toBe('100%');
    expect(table.style.tableLayout).toBe('fixed');
    expect(table.style.borderCollapse).toBe('collapse');
    expect(cell.style.border).not.toBe('');
    expect(cell.style.color).toBe('rgb(0, 0, 0)');
    expect(cell.style.opacity).toBe('1');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    const nodeViewDom = document.createElement('div');

    const { getByRole } = render(
      <ImageViewer nodeViewDom={nodeViewDom} onClose={onClose} />
    );

    fireEvent.click(getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles missing figure content without throwing', () => {
    const nodeViewDom = document.createElement('div');
    const onClose = jest.fn();

    const { container } = render(
      <ImageViewer nodeViewDom={nodeViewDom} onClose={onClose} />
    );

    const viewerContainer = container.querySelector('.image-viewer-content');
    expect(viewerContainer?.contains(nodeViewDom)).toBe(true);
  });
});