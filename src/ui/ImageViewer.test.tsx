import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImageViewer } from './ImageViewer';

describe('ImageViewer', () => {
  let mockNodeViewDom: HTMLElement;
  let mockOnClose: jest.Mock;

  const createNodeViewDom = (includeClip = true): HTMLElement => {
    const nodeViewDom = document.createElement('div');

    const figureContent = document.createElement('div');
    figureContent.className = 'enhanced-table-figure-content';
    nodeViewDom.appendChild(figureContent);

    if (includeClip) {
      const imgClip = document.createElement('div');
      imgClip.className = 'molm-czi-image-view-body-img-clip';
      const firstChild = document.createElement('div');
      imgClip.appendChild(firstChild);
      nodeViewDom.appendChild(imgClip);
    }

    const imgBody = document.createElement('div');
    imgBody.className = 'molm-czi-image-view-body-img';
    nodeViewDom.appendChild(imgBody);

    return nodeViewDom;
  };

  beforeEach(() => {
    mockNodeViewDom = createNodeViewDom();
    mockOnClose = jest.fn();
  });

  it('renders the viewer and closes from the button', () => {
    render(<ImageViewer nodeViewDom={mockNodeViewDom} onClose={mockOnClose} />);

    const overlay = document.querySelector('.image-viewer-overlay');
    const wrapper = document.querySelector('.image-viewer-wrapper') as HTMLElement;
    const content = document.querySelector('.image-viewer-content') as HTMLElement;
    const closeButton = screen.getByRole('button');

    expect(overlay).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ position: 'relative', width: '900px', height: 'auto' });
    expect(content).toHaveStyle({ width: '900px', height: 'auto', overflow: 'auto' });

    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('normalizes figure and image styles before appending the dom', () => {
    render(<ImageViewer nodeViewDom={mockNodeViewDom} onClose={mockOnClose} />);

    const figureContent = mockNodeViewDom.getElementsByClassName(
      'enhanced-table-figure-content'
    )[0] as HTMLElement;
    const imgClipChild = mockNodeViewDom.getElementsByClassName(
      'molm-czi-image-view-body-img-clip'
    )[0].firstElementChild as HTMLElement;
    const imgBody = mockNodeViewDom.getElementsByClassName(
      'molm-czi-image-view-body-img'
    )[0] as HTMLElement;
    const content = document.querySelector('.image-viewer-content') as HTMLElement;

    expect(figureContent.style.width).toBe('864px');
    expect(mockNodeViewDom.style.width).toBe('auto');
    expect(mockNodeViewDom.style.maxWidth).toBe('1024px');
    expect(imgClipChild.style.width).toBe('auto');
    expect(imgClipChild.style.height).toBe('auto');
    expect(imgBody.style.width).toBe('854px');
    expect(imgBody.style.height).toBe('auto');
    expect(content.contains(mockNodeViewDom)).toBe(true);
  });

  it('handles a missing image clip element', () => {
    const nodeViewDomNoImgClip = createNodeViewDom(false);

    render(<ImageViewer nodeViewDom={nodeViewDomNoImgClip} onClose={mockOnClose} />);

    const imgBody = nodeViewDomNoImgClip.getElementsByClassName(
      'molm-czi-image-view-body-img'
    )[0] as HTMLElement;

    expect(nodeViewDomNoImgClip.style.width).toBe('auto');
    expect(imgBody.style.width).toBe('854px');
  });
});
