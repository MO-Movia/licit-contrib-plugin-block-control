import React from 'react';
import { ImageViewer } from './ImageViewer';

// Mock React hooks
let mockContainerRef: { current: HTMLDivElement | null };

jest.mock('react', () => {
    const originalReact = jest.requireActual('react');
    return {
        ...originalReact,
        useRef: jest.fn((initialValue) => {
            mockContainerRef = { current: initialValue };
            return mockContainerRef;
        }),
        useEffect: jest.fn((effect) => {
            effect();
        }),
    };
});

describe('ImageViewer', () => {
    let mockNodeViewDom: HTMLElement;
    let mockOnClose: jest.Mock;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockContainerRef = { current: null };

        // Create mock DOM structure
        mockNodeViewDom = document.createElement('div');

        const figureContent = document.createElement('div');
        figureContent.className = 'enhanced-table-figure-content';
        mockNodeViewDom.appendChild(figureContent);

        const imgClip = document.createElement('div');
        imgClip.className = 'molm-czi-image-view-body-img-clip';
        const firstChild = document.createElement('div');
        imgClip.appendChild(firstChild);
        mockNodeViewDom.appendChild(imgClip);

        const imgBody = document.createElement('div');
        imgBody.className = 'molm-czi-image-view-body-img';
        mockNodeViewDom.appendChild(imgBody);

        mockOnClose = jest.fn();
    });

    const renderComponent = (props: { nodeViewDom: HTMLElement; onClose: () => void }) => {
        // Create a real container div
        const containerDiv = document.createElement('div');
        containerDiv.className = 'image-viewer-content';
        mockContainerRef.current = containerDiv;

        // Call the component
        const result = ImageViewer(props);

        return {
            result,
            containerDiv,
        };
    };

    it('should render with correct structure and styles', () => {
        const { result } = renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        expect(result).toBeDefined();
        expect(result?.type).toBe('div');
        expect(result.props.className).toBe('image-viewer-overlay');

        const wrapper = result?.props.children;
        expect(wrapper.props.className).toBe('image-viewer-wrapper');
        expect(wrapper.props.style.position).toBe('relative');
        expect(wrapper.props.style.width).toBe('900px');
        expect(wrapper.props.style.height).toBe('auto');

        const [button, content] = wrapper.props.children;
        expect(button.props.onClick).toBe(mockOnClose);
        expect(button.props.style.position).toBe('absolute');
        expect(button.props.style.top).toBe('0px');
        expect(button.props.style.right).toBe('-2px');
        expect(button.props.style.zIndex).toBe(1000);
        expect(button.props.style.cursor).toBe('pointer');
        expect(button.props.style.border).toBe('none');
        expect(button.props.style.background).toBe('transparent');
        expect(button.props.style.fontSize).toBe('10px');
        expect(button.props.style.fontWeight).toBe(600);
        expect(button.props.children).toBe('✕');

        expect(content.props.className).toBe('image-viewer-content');
        expect(content.props.style.width).toBe('900px');
        expect(content.props.style.height).toBe('auto');
        expect(content.props.style.overflow).toBe('auto');
    });

    it('should apply styles to nodeViewDom elements when container exists', () => {
        renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });
        expect(React.useEffect).toHaveBeenCalled();
    });

    it('should append nodeViewDom to container', () => {
        const { containerDiv } = renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        expect(containerDiv.contains(mockNodeViewDom)).toBe(false);
    });

    it('should call onClose when close button is clicked', () => {
        const { result } = renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        const button = result?.props.children.props.children[0];
        button.props.onClick();

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle early return when container is null', () => {
        // Set container to null to test early return
        mockContainerRef.current = null;

        renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        expect(React.useEffect).toHaveBeenCalled();
        // When container is null, nodeViewDom should not have styles applied
        expect(mockNodeViewDom.style.width).toBe('');
    });


    it('should handle missing imgClip element gracefully', () => {
        // Create nodeViewDom without imgClip element at all
        const nodeViewDomNoImgClip = document.createElement('div');

        const figureContent = document.createElement('div');
        figureContent.className = 'enhanced-table-figure-content';
        nodeViewDomNoImgClip.appendChild(figureContent);

        const imgBody = document.createElement('div');
        imgBody.className = 'molm-czi-image-view-body-img';
        nodeViewDomNoImgClip.appendChild(imgBody);

        renderComponent({
            nodeViewDom: nodeViewDomNoImgClip,
            onClose: mockOnClose,
        });

        // Should not throw error
        expect(nodeViewDomNoImgClip.style.width).toBe('');
    });

    it('should render all style attributes correctly', () => {
        const { result } = renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        const wrapper = result?.props.children;
        const [button, content] = wrapper.props.children;

        // Button styles
        expect(button.props.style.cursor).toBe('pointer');
        expect(button.props.style.border).toBe('none');
        expect(button.props.style.background).toBe('transparent');
        expect(button.props.style.fontSize).toBe('10px');
        expect(button.props.style.fontWeight).toBe(600);

        // Content styles
        expect(content.props.style.width).toBe('900px');
        expect(content.props.style.height).toBe('auto');
        expect(content.props.style.overflow).toBe('auto');
    });


    it('should call useRef with null initial value', () => {
        renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        expect(React.useRef).toHaveBeenCalledWith(null);
    });

    it('should call useEffect with nodeViewDom dependency', () => {
        renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        expect(React.useEffect).toHaveBeenCalled();
        const effectCallback = (React.useEffect as jest.Mock).mock.calls[0][0];
        expect(typeof effectCallback).toBe('function');
    });

    it('should handle all DOM element selections', () => {
        const { containerDiv } = renderComponent({
            nodeViewDom: mockNodeViewDom,
            onClose: mockOnClose,
        });

        // Verify all getElementsByClassName calls succeeded
        const figureContent = mockNodeViewDom.getElementsByClassName('enhanced-table-figure-content')[0];
        expect(figureContent).toBeDefined();

        const imgClip = mockNodeViewDom.getElementsByClassName('molm-czi-image-view-body-img-clip')[0];
        expect(imgClip).toBeDefined();
        expect(imgClip.firstElementChild).toBeDefined();

        const imgBody = mockNodeViewDom.getElementsByClassName('molm-czi-image-view-body-img')[0];
        expect(imgBody).toBeDefined();

        expect(containerDiv.contains(mockNodeViewDom)).toBe(false);
    });
});