import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { addNotesCommand, deleteNotesCommand } from './EnhancedTableCommands';
import { createPopUp } from '@modusoperandi/licit-ui-commands';
import { EnhancedTableFigureView } from './EnhancedTableFigureView';

jest.mock('prosemirror-model');
jest.mock('prosemirror-view');
jest.mock('prosemirror-state', () => ({
  TextSelection: {
    create: jest.fn(() => 'text-selection'),
  },
}));
jest.mock('./EnhancedTableCommands', () => ({
  addNotesCommand: jest.fn(() => 'notes-transaction'),
  deleteNotesCommand: jest.fn(() => 'delete-notes-transaction'),
}));
jest.mock('@modusoperandi/licit-ui-commands', () => ({
  atAnchorTopCenter: jest.fn(),
  createPopUp: jest.fn(() => ({ close: jest.fn() })),
  uuid: jest.fn(() => 'test-view-id'),
}));

type MockNode = ProseMirrorNode & {
  attrs: Record<string, unknown>;
  child: jest.Mock;
  childCount: number;
  content?: { size: number };
  descendants: jest.Mock;
  forEach: jest.Mock;
  nodeSize: number;
  type: { name: string };
};

type MockView = EditorView & {
  dispatch: jest.Mock;
  dom: HTMLElement;
  focus: jest.Mock;
  state: {
    doc: { content: { size: number }; nodeAt: jest.Mock; resolve: jest.Mock };
    plugins: Array<Record<string, unknown>>;
    schema: { nodes: { paragraph: { create: jest.Mock } } };
    tr: {
      delete: jest.Mock;
      doc: { resolve: jest.Mock };
      insert: jest.Mock;
      scrollIntoView: jest.Mock;
      setNodeMarkup: jest.Mock;
      setSelection: jest.Mock;
    };
  };
};

describe('EnhancedTableFigureView', () => {
  let mockNode: MockNode;
  let mockView: MockView;
  let mockGetPos: jest.Mock;
  let view: EnhancedTableFigureView;

  const createMockTransaction = () => {
    const tr = {
      delete: jest.fn(() => tr),
      doc: { resolve: jest.fn((pos: number) => ({ pos })) },
      insert: jest.fn(() => tr),
      scrollIntoView: jest.fn(() => tr),
      setNodeMarkup: jest.fn(() => tr),
      setSelection: jest.fn(() => tr),
    };
    return tr;
  };

  const createContentNode = (
    typeName: string,
    children: Array<Partial<MockNode>> = [],
    nodeSize = 1
  ): Partial<MockNode> => ({
    child: jest.fn((index: number) => children[index]),
    childCount: children.length,
    content: { size: children.length },
    nodeSize,
    type: { name: typeName },
  });

  const setNodeChildren = (node: MockNode, children: Array<Partial<MockNode>>) => {
    node.childCount = children.length;
    node.child.mockImplementation((index: number) => children[index]);
    node.forEach.mockImplementation((callback) =>
      children.forEach((child, offset) => callback(child, offset))
    );
  };

  const createMockNode = (attrs: Record<string, unknown> = {}): MockNode =>
    ({
      attrs: {
        figureType: 'table',
        id: 'test-id',
        orientation: 'portrait',
        ...attrs,
      },
      child: jest.fn(),
      childCount: 0,
      descendants: jest.fn(),
      forEach: jest.fn(),
      nodeSize: 6,
      type: {
        name: 'enhanced_table_figure',
      },
    }) as unknown as MockNode;

  const getLastPopUpCall = () => {
    const createPopUpMock = createPopUp as jest.Mock;
    return createPopUpMock.mock.calls[createPopUpMock.mock.calls.length - 1];
  };

  const openMenu = () => {
    view['handleHamburgerMenuClick'](new Event('click'));
    return getLastPopUpCall()[1].menuItems as Array<{
      action: (anchor?: HTMLElement) => void;
      disabled?: boolean;
      id: string;
      label: string;
    }>;
  };

  const mockImageInFigure = (imageNode: { attrs: Record<string, unknown> }, nested = false) => {
    const imageContent = createContentNode('image');
    const nestedContent = createContentNode(
      'wrapper',
      [createContentNode('text', [], 2), imageContent],
      4
    );
    const bodyNode = createContentNode(
      'enhanced_table_figure_body',
      [createContentNode('text', [], 3), nested ? nestedContent : imageContent],
      6
    );

    setNodeChildren(mockNode, [bodyNode]);
    mockView.state.doc.nodeAt.mockReturnValue(imageNode);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const parentElement = document.createElement('section');
    const editorDom = document.createElement('div');
    parentElement.appendChild(editorDom);

    mockNode = createMockNode();
    mockView = {
      dispatch: jest.fn(),
      dom: editorDom,
      focus: jest.fn(),
      state: {
        doc: { content: { size: 100 }, nodeAt: jest.fn(), resolve: jest.fn((pos: number) => ({ pos })) },
        plugins: [],
        schema: { nodes: { paragraph: { create: jest.fn(() => 'paragraph-node') } } },
        tr: createMockTransaction(),
      },
    } as unknown as MockView;
    mockGetPos = jest.fn().mockReturnValue(10);

    view = new EnhancedTableFigureView(mockNode, mockView, mockGetPos);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor and handles', () => {
    it('initializes with the expected DOM structure for a table', () => {
      expect(view.dom).toBeDefined();
      expect(view.dom.id).toBe('test-view-id');
      expect(view.dom.className).toBe('enhanced-table-figure has-hover-handle');
      expect(view.dom.dataset.type).toBe('enhanced-table-figure');
      expect(view.dom.dataset.id).toBe('test-id');
      expect(view.dom.dataset.figureType).toBe('table');
      expect(view.contentDOM.parentElement).toBe(view.dom);
      expect(view.contentDOM.dataset.orientation).toBe('portrait');
      expect(view.dom.querySelector('.enhanced-table-figure-maximize-button')).toBeNull();
    });

    it('creates a maximize handle for non-table figures and handles keyboard activation', () => {
      const figureNode = createMockNode({ figureType: 'figure' });
      const figureView = new EnhancedTableFigureView(figureNode, mockView, mockGetPos);
      const maximizeButton = figureView.dom.querySelector(
        '.enhanced-table-figure-maximize-button'
      ) as HTMLElement;

      expect(maximizeButton).toBeTruthy();

      maximizeButton.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

      const [Component, props, options] = getLastPopUpCall();
      expect(Component.name).toBe('ImageViewer');
      expect(props.nodeViewDom.className).toBe('enhanced-table-figure');
      expect(options.anchor).toBe(mockView.dom.parentElement);
    });

    it('opens the hamburger menu from mouse and keyboard events', () => {
      const handle = view.dom.querySelector('.enhanced-table-figure-select-handle') as HTMLElement;

      fireEvent.click(handle);
      expect(getLastPopUpCall()[1].menuItems).toHaveLength(5);

      handle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
      expect(getLastPopUpCall()[1].menuItems).toHaveLength(5);
    });
  });

  describe('hamburger menu', () => {
    it('routes Apply Style to the installed styles plugin for the nested table', () => {
      const picker = { close: jest.fn() };
      const openTableStylePicker = jest.fn(() => picker);
      mockView.state.plugins = [{ openTableStylePicker }];
      mockNode.descendants.mockImplementation((callback) => {
        callback({ type: { spec: { tableRole: 'table' } } }, 2);
      });

      const applyStyle = openMenu().find((item) => item.id === 'apply-style');
      const anchor = document.createElement('button');

      expect(applyStyle?.disabled).toBe(false);
      applyStyle?.action(anchor);
      expect(openTableStylePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          anchor,
          getTablePos: expect.any(Function),
          view: mockView,
        })
      );
      expect(openTableStylePicker.mock.calls[0][0].getTablePos()).toBe(13);
    });

    it('renders menu items and invokes only enabled actions', () => {
      const action = jest.fn();
      const disabledAction = jest.fn();
      view['handleHamburgerMenuClick'](new Event('click'));

      const MenuComponent = getLastPopUpCall()[0];
      render(
        React.createElement(MenuComponent, {
          close: jest.fn(),
          menuItems: [
            { action, disabled: false, icon: 'arrow_upward', id: 'enabled', label: 'Enabled' },
            { action: disabledAction, disabled: true, icon: 'delete', id: 'disabled', label: 'Disabled' },
          ],
        })
      );

      expect(screen.getByText('arrow_upward')).toHaveClass('molm-czi-icon');
      expect(screen.getByText('delete')).toHaveClass('molm-czi-icon');
      fireEvent.click(screen.getByText('Enabled'));
      fireEvent.click(screen.getByText('Disabled'));

      expect(action).toHaveBeenCalledTimes(1);
      expect(disabledAction).not.toHaveBeenCalled();
    });

    it('includes add notes for a table without notes and delete note when notes exist', () => {
      let menuItems = openMenu();
      expect(menuItems.find((item) => item.id === 'add-notes')).toBeDefined();
      expect(menuItems.find((item) => item.id === 'delete-notes')).toBeUndefined();

      setNodeChildren(mockNode, [createContentNode('enhanced_table_figure_notes')]);

      menuItems = openMenu();
      expect(menuItems.find((item) => item.id === 'add-notes')).toBeUndefined();
      expect(menuItems.find((item) => item.id === 'delete-notes')).toEqual(
        expect.objectContaining({
          action: expect.any(Function),
          icon: 'clear',
          id: 'delete-notes',
          label: 'Delete Notes',
        })
      );
    });

    it('shows the full image menu for figure nodes', () => {
      const figureNode = createMockNode({ figureType: 'figure' });
      const figureView = new EnhancedTableFigureView(figureNode, mockView, mockGetPos);

      figureView['handleHamburgerMenuClick'](new Event('click'));

      const menuItems = getLastPopUpCall()[1].menuItems as Array<{ id: string }>;
      expect(menuItems.map((item) => item.id)).toEqual([
        'insert-above',
        'insert-below',
        'choose-file',
        'paste-clipboard',
        'add-notes',
        'crop',
        'reset-crop',
        'delete',
      ]);
    });

    it('does not include add notes for non-table and non-figure types', () => {
      const otherNode = createMockNode({ figureType: 'other' });
      const otherView = new EnhancedTableFigureView(otherNode, mockView, mockGetPos);

      otherView['handleHamburgerMenuClick'](new Event('click'));

      const menuItems = getLastPopUpCall()[1].menuItems as Array<{ id: string }>;
      expect(menuItems.find((item) => item.id === 'add-notes')).toBeUndefined();
    });
  });

  describe('menu actions', () => {
    it('inserts paragraphs above and below the figure', async () => {
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'insert-above')?.action();
      expect(mockView.state.tr.insert).toHaveBeenCalledWith(10, 'paragraph-node');
      expect(TextSelection.create).toHaveBeenCalledWith(mockView.state.tr.doc, 11);
      expect(mockView.state.tr.scrollIntoView).toHaveBeenCalledTimes(1);
      expect(mockView.dispatch).toHaveBeenCalledWith(mockView.state.tr);
      expect(mockView.focus).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(mockView.focus).toHaveBeenCalledTimes(1);

      menuItems.find((item) => item.id === 'insert-below')?.action();
      expect(mockView.state.tr.insert).toHaveBeenCalledWith(16, 'paragraph-node');
      expect(TextSelection.create).toHaveBeenCalledWith(mockView.state.tr.doc, 17);
      expect(mockView.state.tr.scrollIntoView).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      expect(mockView.focus).toHaveBeenCalledTimes(2);
    });

    it('deletes the figure', () => {
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'delete')?.action();

      expect(mockView.state.tr.delete).toHaveBeenCalledWith(10, 16);
      expect(mockView.dispatch).toHaveBeenCalledWith(mockView.state.tr);
    });

    it('adds notes through the command', () => {
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'add-notes')?.action();

      expect(addNotesCommand).toHaveBeenCalledWith(mockView.state.tr, mockView.state.schema, 10);
      expect(mockView.dispatch).toHaveBeenCalledWith('notes-transaction');
    });

    it('deletes notes through the command', () => {
      setNodeChildren(mockNode, [createContentNode('enhanced_table_figure_notes')]);
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'delete-notes')?.action();

      expect(deleteNotesCommand).toHaveBeenCalledWith(mockView.state.tr, 10);
      expect(mockView.dispatch).toHaveBeenCalledWith('delete-notes-transaction');
    });

    it('opens crop and dispatches confirmed crop data', () => {
      const createPopUpMock = createPopUp as jest.Mock;
      mockNode.attrs.figureType = 'figure';
      const imageNode = { attrs: { cropData: null, src: 'data:image/png;base64,original' } };
      mockImageInFigure(imageNode);
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'crop')?.action();

      const popupHandle = createPopUpMock.mock.results.at(-1)?.value;
      const cropProps = getLastPopUpCall()[1];
      const cropData = {
        croppedBase64: 'data:image/png;base64,cropped',
        height: 20,
        left: 1,
        top: 2,
        width: 30,
      };
      cropProps.onConfirm(cropData);

      expect(mockView.state.tr.setNodeMarkup).toHaveBeenCalledWith(15, null, {
        cropData,
        src: 'data:image/png;base64,original',
      });
      expect(popupHandle.close).toHaveBeenCalledWith(cropData);
      expect(mockView.dispatch).toHaveBeenCalledWith(mockView.state.tr);
    });

    it('closes crop without dispatching on cancel', () => {
      const createPopUpMock = createPopUp as jest.Mock;
      mockNode.attrs.figureType = 'figure';
      const imageNode = { attrs: { src: 'data:image/png;base64,original' } };
      mockImageInFigure(imageNode);
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'crop')?.action();
      const popupHandle = createPopUpMock.mock.results.at(-1)?.value;

      getLastPopUpCall()[1].onCancel();

      expect(popupHandle.close).toHaveBeenCalledWith(null);
      expect(mockView.dispatch).not.toHaveBeenCalledWith(mockView.state.tr);
    });

    it('does not open crop when no image exists', () => {
      const createPopUpMock = createPopUp as jest.Mock;
      mockNode.attrs.figureType = 'figure';
      mockNode.forEach.mockImplementation(jest.fn());
      const menuItems = openMenu();
      const callsBeforeCrop = createPopUpMock.mock.calls.length;

      menuItems.find((item) => item.id === 'crop')?.action();

      expect(createPopUpMock.mock.calls).toHaveLength(callsBeforeCrop);
    });

    it('resets direct and nested image crop data', () => {
      mockNode.attrs.figureType = 'figure';
      const imageNode = { attrs: { cropData: { left: 1 }, src: 'image-src' } };
      mockImageInFigure(imageNode, true);
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'reset-crop')?.action();

      expect(mockView.state.tr.setNodeMarkup).toHaveBeenCalledWith(18, undefined, {
        cropData: null,
        src: 'image-src',
      });
      expect(mockView.dispatch).toHaveBeenCalledWith(mockView.state.tr);
    });

    it('does not reset crop when the resolved image node is missing', () => {
      mockNode.attrs.figureType = 'figure';
      mockImageInFigure({ attrs: {} });
      mockView.state.doc.nodeAt.mockReturnValue(null);
      const menuItems = openMenu();

      menuItems.find((item) => item.id === 'reset-crop')?.action();

      expect(mockView.state.tr.setNodeMarkup).not.toHaveBeenCalled();
    });
  });

  describe('image source updates', () => {
    const setClipboard = (clipboard: unknown) => {
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        get: () => clipboard,
      });
    };

    class MockFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null;

      readAsDataURL = jest.fn(() => {
        this.onload?.({ target: { result: 'data:image/png;base64,new' } });
      });
    }

    beforeEach(() => {
      Object.defineProperty(global, 'FileReader', {
        configurable: true,
        value: MockFileReader,
      });
    });

    it('updates the image source from a selected file', () => {
      mockNode.attrs.figureType = 'figure';
      const imageNode = { attrs: { src: 'old-src' } };
      mockImageInFigure(imageNode);
      const originalCreateElement = document.createElement.bind(document);
      const input = document.createElement('input');
      const click = jest.spyOn(input, 'click').mockImplementation(jest.fn());
      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'input') {
          return input;
        }
        return originalCreateElement(tagName);
      });

      openMenu()
        .find((item) => item.id === 'choose-file')
        ?.action();

      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['image'], 'image.png', { type: 'image/png' })],
      });
      input.onchange?.({ target: input } as unknown as Event);

      expect(input.type).toBe('file');
      expect(input.accept).toBe('image/*');
      expect(click).toHaveBeenCalled();
      expect(mockView.state.tr.setNodeMarkup).toHaveBeenCalledWith(15, undefined, {
        src: 'data:image/png;base64,new',
      });
    });

    it('ignores file selection when no file is selected', () => {
      mockNode.attrs.figureType = 'figure';
      const input = document.createElement('input');
      jest.spyOn(document, 'createElement').mockReturnValue(input);

      openMenu()
        .find((item) => item.id === 'choose-file')
        ?.action();
      input.onchange?.({ target: input } as unknown as Event);

      expect(mockView.state.tr.setNodeMarkup).not.toHaveBeenCalled();
    });

    it('updates the image source from clipboard image data', async () => {
      mockNode.attrs.figureType = 'figure';
      const imageNode = { attrs: { src: 'old-src' } };
      mockImageInFigure(imageNode);
      setClipboard({
        read: jest.fn().mockResolvedValue([
          {
            getType: jest.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' })),
            types: ['text/plain', 'image/png'],
          },
        ]),
      });

      openMenu()
        .find((item) => item.id === 'paste-clipboard')
        ?.action();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockView.state.tr.setNodeMarkup).toHaveBeenCalledWith(15, undefined, {
        src: 'data:image/png;base64,new',
      });
    });

    it('logs when clipboard read is unavailable', () => {
      mockNode.attrs.figureType = 'figure';
      const error = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      setClipboard(undefined);

      openMenu()
        .find((item) => item.id === 'paste-clipboard')
        ?.action();

      expect(error).toHaveBeenCalledWith('Clipboard API not available');
    });

    it('logs when clipboard read fails', async () => {
      mockNode.attrs.figureType = 'figure';
      const error = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      const read = jest.fn().mockRejectedValue('nope');
      setClipboard({ read });

      openMenu()
        .find((item) => item.id === 'paste-clipboard')
        ?.action();
      await Promise.resolve();
      await Promise.resolve();

      expect(read).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith('Failed to read from clipboard:', 'nope');
    });
  });

  describe('selection, update, and cleanup', () => {
    it('updates attributes and preserves the selected class', () => {
      view.selectNode();

      const updatedNode = createMockNode({
        figureType: 'figure',
        id: 'new-id',
        maximized: true,
        orientation: 'landscape',
      });
      updatedNode.type = mockNode.type;

      expect(view.update(updatedNode)).toBe(true);
      expect(view.node).toBe(updatedNode);
      expect(view.dom.dataset.id).toBe('new-id');
      expect(view.dom.dataset.orientation).toBe('landscape');
      expect(view.dom.dataset.maximized).toBe('true');
      expect(view.dom.className).toBe(
        'enhanced-table-figure has-hover-handle landscape maximized ProseMirror-selectednode'
      );
      expect(view.contentDOM.dataset.orientation).toBe('landscape');
    });

    it('keeps wrapper DOM untouched when only child content changes', () => {
      view.selectNode();
      const setAttribute = jest.spyOn(view.dom, 'setAttribute');
      const updatedNode = createMockNode({
        figureType: 'table',
        id: 'test-id',
        orientation: 'portrait',
      });
      updatedNode.type = mockNode.type;
      updatedNode.nodeSize = mockNode.nodeSize + 1;

      expect(view.update(updatedNode)).toBe(true);

      expect(view.node).toBe(updatedNode);
      expect(setAttribute).not.toHaveBeenCalled();
      expect(view.dom.className).toBe('enhanced-table-figure has-hover-handle ProseMirror-selectednode');
    });

    it('returns false when update receives a different node type', () => {
      const differentNode = createMockNode();
      differentNode.type = { name: 'different_type' };

      expect(view.update(differentNode)).toBe(false);
    });

    it('selects, deselects, resizes, stops no events, and destroys popups', () => {
      const createPopUpMock = createPopUp as jest.Mock;
      view.selectNode();
      expect(view.dom.classList.contains('ProseMirror-selectednode')).toBe(true);
      expect(view.dom.dataset.active).toBe('true');

      openMenu();
      const menuHandle = createPopUpMock.mock.results.at(-1)?.value;
      view.deselectNode();
      expect(view.dom.classList.contains('ProseMirror-selectednode')).toBe(false);
      expect(view.dom.dataset.active).toBe('false');

      view.onResizeEnd(320, 240);
      expect(mockView.state.tr.setNodeMarkup).toHaveBeenCalledWith(10, undefined, {
        ...mockNode.attrs,
        height: 240,
        width: 320,
      });
      expect(view.stopEvent(new Event('click'))).toBe(false);

      openMenu();
      const destroyHandle = createPopUpMock.mock.results.at(-1)?.value;
      view.destroy();
      expect(menuHandle.close).toHaveBeenCalledWith(undefined);
      expect(destroyHandle.close).toHaveBeenCalledWith(undefined);
    });
  });
});
