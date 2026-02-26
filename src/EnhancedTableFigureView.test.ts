import { EnhancedTableFigureView } from './EnhancedTableFigureView';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { addNotesCommand } from './EnhancedTableCommands';
import {
  atAnchorBottomCenter,
  createPopUp,
} from '@modusoperandi/licit-ui-commands';
import { ImageInlineEditor } from './ui/ImageInlineEditor';
import { ImageViewer } from './ui/ImageViewer';

jest.mock('prosemirror-model');
jest.mock('prosemirror-view');
jest.mock('prosemirror-state');
jest.mock('./EnhancedTableCommands');
jest.mock('@modusoperandi/licit-ui-commands');
jest.mock('./ui/ImageInlineEditor');

describe('EnhancedTableFigureView', () => {
  let mockNode: ProseMirrorNode;
  let mockView: EditorView;
  let mockGetPos: jest.Mock;
  let mockEditorDom: HTMLElement;
  let mockTr: {
    doc: object;
    setSelection: jest.Mock;
    setNodeMarkup: jest.Mock;
  };
  let view: EnhancedTableFigureView;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';

    (NodeSelection as unknown as { create: jest.Mock }).create = jest
      .fn()
      .mockReturnValue({ type: 'node-selection' });
    (TextSelection as unknown as { create: jest.Mock }).create = jest
      .fn()
      .mockReturnValue({ type: 'text-selection' });

    mockNode = {
      attrs: {
        id: 'test-id',
        figureType: 'table',
        orientation: 'portrait',
      },
      type: {
        name: 'enhanced_table_figure',
      },
      forEach: jest.fn(),
    } as unknown as ProseMirrorNode;

    mockEditorDom = document.createElement('div');
    const parentDom = document.createElement('div');
    parentDom.appendChild(mockEditorDom);

    mockTr = {
      doc: {},
      setSelection: jest.fn().mockReturnThis(),
      setNodeMarkup: jest.fn().mockReturnThis(),
    };

    mockView = {
      state: {
        tr: mockTr,
        schema: {},
        selection: { from: 10 },
        doc: {},
      },
      dispatch: jest.fn(),
      dom: mockEditorDom,
    } as unknown as EditorView;

    mockGetPos = jest.fn().mockReturnValue(10);
    view = new EnhancedTableFigureView(mockNode, mockView, mockGetPos);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('initializes with expected DOM structure', () => {
      expect(view.dom.tagName).toBe('DIV');
      expect(view.dom.className).toBe('enhanced-table-figure has-hover-handle');
      expect(view.dom.getAttribute('data-type')).toBe('enhanced-table-figure');
      expect(view.dom.getAttribute('data-id')).toBe('test-id');
      expect(view.dom.getAttribute('data-figure-type')).toBe('table');
      expect(view.contentDOM.parentElement).toBe(view.dom);
      expect(view.contentDOM.className).toBe('enhanced-table-figure-content');
      expect(view.addNotesButton).toBeDefined();
      expect(view.selectHandle).toBeDefined();
      expect(view.maximizeButton).toBeDefined();
    });

    it('sets expected width styles', () => {
      expect(view.dom.style.width).toBe('624px');
      expect(view.dom.style.maxWidth).toBe('624px');
      expect(view.contentDOM.style.width).toBe('100%');
    });
  });

  describe('button handlers', () => {
    it('dispatches add-notes transaction on add-notes click', () => {
      (addNotesCommand as jest.Mock).mockReturnValue(mockTr);

      view.addNotesButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );

      expect(addNotesCommand).toHaveBeenCalledWith(mockTr, {}, 10);
      expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
    });

    it('sets node selection when selection is not current node', () => {
      (mockView.state as any).selection = { from: 5 };
      const nextSelection = { type: 'next-node-selection' };
      (NodeSelection as unknown as { create: jest.Mock }).create.mockReturnValue(
        nextSelection
      );

      view.selectHandle.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );

      expect((NodeSelection as unknown as { create: jest.Mock }).create).toHaveBeenCalledWith(
        {},
        10
      );
      expect(mockTr.setSelection).toHaveBeenCalledWith(nextSelection);
      expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
    });

    it('switches to text selection when selecting the same node', () => {
      const selectedNode = Object.create((NodeSelection as any).prototype);
      selectedNode.from = 10;
      (mockView.state as any).selection = selectedNode;
      const textSelection = { type: 'text-selection' };
      (TextSelection as unknown as { create: jest.Mock }).create.mockReturnValue(
        textSelection
      );

      view.selectHandle.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );

      expect((TextSelection as unknown as { create: jest.Mock }).create).toHaveBeenCalledWith(
        {},
        11
      );
      expect(mockTr.setSelection).toHaveBeenCalledWith(textSelection);
      expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
    });
  });

  describe('update', () => {
    it('returns false for a different node type object', () => {
      const differentTypeNode = {
        ...mockNode,
        type: { name: 'different_type' },
      } as unknown as ProseMirrorNode;

      expect(view.update(differentTypeNode)).toBe(false);
    });

    it('updates attrs and preserves selected/handle classes', () => {
      view.dom.classList.add('ProseMirror-selectednode');
      const updatedNode = {
        ...mockNode,
        attrs: {
          ...mockNode.attrs,
          id: 'new-id',
          figureType: 'figure',
          orientation: 'landscape',
          maximized: true,
        },
      } as unknown as ProseMirrorNode;

      expect(view.update(updatedNode)).toBe(true);
      expect(view.node).toBe(updatedNode);
      expect(view.dom.getAttribute('data-id')).toBe('new-id');
      expect(view.dom.getAttribute('data-figure-type')).toBe('figure');
      expect(view.dom.className).toContain('landscape');
      expect(view.dom.className).toContain('maximized');
      expect(view.dom.className).toContain('ProseMirror-selectednode');
      expect(view.dom.className).toContain('has-hover-handle');
    });
  });

  describe('updateNotesTrigger', () => {
    it('shows add notes when no notes exist and figureType is table', () => {
      (mockNode.forEach as jest.Mock).mockImplementation(() => {});
      view.updateNotesTrigger();
      expect(view.addNotesButton.style.display).toBe('block');
    });

    it('hides add notes when notes exist', () => {
      (mockNode.forEach as jest.Mock).mockImplementation((callback) => {
        callback({
          type: {
            name: 'enhanced_table_figure_notes',
          },
        });
      });
      view.updateNotesTrigger();
      expect(view.addNotesButton.style.display).toBe('none');
    });

    it('hides add notes for other figure types', () => {
      const otherNode = {
        ...mockNode,
        attrs: {
          ...mockNode.attrs,
          figureType: 'other',
        },
      } as unknown as ProseMirrorNode;
      const otherView = new EnhancedTableFigureView(otherNode, mockView, mockGetPos);
      otherView.updateNotesTrigger();
      expect(otherView.addNotesButton.style.display).toBe('none');
    });
  });

  describe('selection handling', () => {
    it('adds selected class and active flag on selectNode', () => {
      view.selectNode();
      expect(view.dom.classList.contains('ProseMirror-selectednode')).toBe(true);
      expect(view.dom.getAttribute('data-active')).toBe('true');
    });

    it('removes selected class and active flag on deselectNode', () => {
      view.selectNode();
      view.deselectNode();
      expect(view.dom.classList.contains('ProseMirror-selectednode')).toBe(false);
      expect(view.dom.getAttribute('data-active')).toBeNull();
    });
  });

  describe('maximize button', () => {
    it('opens popup anchored to editor parent', () => {
      view.maximizeButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );

      expect(createPopUp).toHaveBeenCalledWith(
        ImageViewer,
        expect.objectContaining({
          nodeViewDom: expect.any(HTMLElement),
          onClose: expect.any(Function),
        }),
        expect.objectContaining({
          autoDismiss: false,
          modal: false,
          anchor: mockEditorDom.parentElement,
        })
      );
    });

    it('cleans up popup handle when popup onClose is called', () => {
      const popupHandle = { close: jest.fn() };
      (createPopUp as jest.Mock).mockReturnValue(popupHandle);

      view.maximizeButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );

      const popupProps = (createPopUp as jest.Mock).mock.calls[0][1];
      popupProps.onClose();

      expect(popupHandle.close).toHaveBeenCalled();
      expect((view as any)._popUp).toBeNull();
    });

    it('preserves notes styles in popup clone', () => {
      const notes = document.createElement('div');
      notes.className = 'enhanced-table-figure-notes';
      notes.style.color = 'rgb(10, 20, 30)';
      notes.style.opacity = '0.95';

      const paragraph = document.createElement('p');
      paragraph.textContent = '(TBD) Notes added';
      paragraph.style.color = 'rgb(40, 50, 60)';
      paragraph.style.opacity = '0.85';
      notes.appendChild(paragraph);
      view.dom.appendChild(notes);

      view.maximizeButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );

      const popupProps = (createPopUp as jest.Mock).mock.calls[0][1];
      const popupNode = popupProps.nodeViewDom as HTMLElement;
      const clonedNotes = popupNode.querySelector(
        '.enhanced-table-figure-notes'
      ) as HTMLElement;
      const clonedParagraph = clonedNotes.querySelector('p') as HTMLElement;

      expect(clonedNotes.style.color).toBe('rgb(10, 20, 30)');
      expect(clonedNotes.style.getPropertyPriority('color')).toBe('important');
      expect(clonedNotes.style.opacity).toBe('0.95');
      expect(clonedNotes.style.getPropertyPriority('opacity')).toBe('important');
      expect(clonedParagraph.style.color).toBe('rgb(40, 50, 60)');
      expect(clonedParagraph.style.getPropertyPriority('color')).toBe(
        'important'
      );
      expect(clonedParagraph.style.opacity).toBe('0.85');
      expect(clonedParagraph.style.getPropertyPriority('opacity')).toBe(
        'important'
      );
    });
  });

  describe('onResizeEnd', () => {
    it('updates width and height attrs via setNodeMarkup', () => {
      view.onResizeEnd(640, 320);

      expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(
        10,
        undefined,
        expect.objectContaining({
          width: 640,
          height: 320,
        })
      );
      expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
    });
  });

  describe('destroy', () => {
    it('closes inline editor on destroy', () => {
      (view as any)._inlineEditor = { close: jest.fn() };
      view.destroy();
      expect((view as any)._inlineEditor.close).toHaveBeenCalledWith(undefined);
    });
  });

  describe('stopEvent', () => {
    it('always returns false', () => {
      expect(view.stopEvent(new Event('click'))).toBe(false);
    });
  });

  describe('_renderInlineEditor', () => {
    it('closes existing popup when element is not active', () => {
      const inlineEditor = { close: jest.fn() };
      (view as any)._inlineEditor = inlineEditor;
      document.body.appendChild(view.dom);

      (view as any)._renderInlineEditor();

      expect(inlineEditor.close).toHaveBeenCalledWith(undefined);
      expect(createPopUp).not.toHaveBeenCalled();
    });

    it('creates popup when element is active', () => {
      document.body.appendChild(view.dom);
      view.dom.dataset.active = 'true';
      const popupHandle = { close: jest.fn() };
      (createPopUp as jest.Mock).mockReturnValue(popupHandle);

      (view as any)._renderInlineEditor();

      expect(createPopUp).toHaveBeenCalledWith(
        ImageInlineEditor,
        expect.objectContaining({
          value: mockNode.attrs,
          onSelect: view._onChange,
          editorView: mockView,
        }),
        expect.objectContaining({
          anchor: view.dom,
          autoDismiss: false,
          position: atAnchorBottomCenter,
        })
      );
      expect((view as any)._inlineEditor).toBe(popupHandle);
    });

    it('does not create another popup when one already exists', () => {
      document.body.appendChild(view.dom);
      view.dom.dataset.active = 'true';
      (view as any)._inlineEditor = { close: jest.fn() };

      (view as any)._renderInlineEditor();

      expect(createPopUp).not.toHaveBeenCalled();
    });

    it('sets inline editor to null when popup onClose runs', () => {
      document.body.appendChild(view.dom);
      view.dom.dataset.active = 'true';
      (createPopUp as jest.Mock).mockReturnValue({ close: jest.fn() });

      (view as any)._renderInlineEditor();
      const popupOptions = (createPopUp as jest.Mock).mock.calls[0][2];
      popupOptions.onClose();

      expect((view as any)._inlineEditor).toBeNull();
    });
  });

  describe('_onChange', () => {
    it('dispatches transaction with updated align value', () => {
      const nodeSelection = { type: 'node-selection' };
      (NodeSelection as unknown as { create: jest.Mock }).create.mockReturnValue(
        nodeSelection
      );

      view._onChange({ align: 'left' });

      expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(
        10,
        null,
        expect.objectContaining({ align: 'left' })
      );
      expect((NodeSelection as unknown as { create: jest.Mock }).create).toHaveBeenCalledWith(
        mockTr.doc,
        10
      );
      expect(mockTr.setSelection).toHaveBeenCalledWith(nodeSelection);
      expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
    });

    it('uses null align when no value is provided', () => {
      view._onChange(undefined);

      expect(mockTr.setNodeMarkup).toHaveBeenCalledWith(
        10,
        null,
        expect.objectContaining({ align: null })
      );
    });
  });
});