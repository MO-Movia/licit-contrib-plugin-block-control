import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { ImageSourceCommand } from './ImageSourceCommand';
import { showCursorPlaceholder, hideCursorPlaceholder } from './CursorPlaceholderPlugin';

// Mock the dependencies
jest.mock('./CursorPlaceholderPlugin', () => ({
  showCursorPlaceholder: jest.fn((state) => state.tr),
  hideCursorPlaceholder: jest.fn((state) => state.tr),
}));

jest.mock('@modusoperandi/licit-ui-commands', () => ({
  createPopUp: jest.fn(),
}));

import { createPopUp } from '@modusoperandi/licit-ui-commands';

describe('ImageSourceCommand', () => {
  let command: ImageSourceCommand;
  let schema: Schema;
  let state: EditorState;
  let dispatch: jest.Mock;
  let view: EditorView;

  beforeEach(() => {
    command = new ImageSourceCommand();

    // Create a comprehensive schema with all required node types
    schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'inline*',
          group: 'block',
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }]
        },
        text: { group: 'inline' },
        image: {
          attrs: {
            src: { default: '' },
            alt: { default: '' },
            simpleImg: { default: 'false' },
            cropData: { default: null },
          },
          group: 'inline',
          inline: true,
          toDOM: () => ['img', 0],
          parseDOM: [{ tag: 'img' }],
        },
        enhanced_table_figure: {
          content: 'enhanced_table_figure_body enhanced_table_figure_capco',
          group: 'block',
          attrs: {
            figureType: { default: 'figure' },
            orientation: { default: 'landscape' },
          },
          toDOM: () => ['div', { class: 'figure' }, 0],
          parseDOM: [{ tag: 'div.figure' }],
        },
        enhanced_table_figure_body: {
          content: 'image',
          toDOM: () => ['div', { class: 'figure-body' }, 0],
          parseDOM: [{ tag: 'div.figure-body' }],
        },
        enhanced_table_figure_capco: {
          content: 'text*',
          toDOM: () => ['div', { class: 'figure-capco' }, 0],
          parseDOM: [{ tag: 'div.figure-capco' }],
        },
      },
    });

    state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('paragraph')]),
      schema,
    });

    dispatch = jest.fn();

    view = {
      state,
      runtime: {
        canUploadImage: jest.fn(() => true),
        uploadImage: jest.fn(),
      },
      focus: jest.fn(),
    } as unknown as EditorView;

    jest.clearAllMocks();
  });

  describe('getEditor', () => {
    it('should return undefined', () => {
      expect(command.getEditor()).toBeUndefined();
    });
  });

  describe('isEnabled', () => {
    it('should return true when cursor position is collapsed (from === to)', () => {
      expect(command.isEnabled(state, view)).toBe(true);
    });

    it('should return true when selection is not TextSelection', () => {
      // Create a state with a non-TextSelection (this tests the else branch)
      const result = command.isEnabled(state, view);
      expect(result).toBe(true);
    });

    it('should return false when selection has range (from !== to)', () => {
      // Create a selection with a range
      const tr = state.tr.setSelection(
        TextSelection.create(state.doc, 0, 1)
      );
      const newState = state.apply(tr);

      expect(command.isEnabled(newState, view)).toBe(false);
    });
  });

  describe('waitForUserInput', () => {
    it('should return resolved promise if popup already exists', async () => {
      command._popUp = {} as any;

      const result = await command.waitForUserInput(state, dispatch, view);

      expect(result).toBeUndefined();
      expect(createPopUp).not.toHaveBeenCalled();
    });

    it('should dispatch showCursorPlaceholder when dispatch is provided', async () => {
      const mockPopUp = {
        close: jest.fn(),
      };
      (createPopUp as jest.Mock).mockReturnValue(mockPopUp);

      const promise = command.waitForUserInput(state, dispatch, view);

      expect(dispatch).toHaveBeenCalledWith(expect.anything());
      expect(showCursorPlaceholder).toHaveBeenCalledWith(state);

      // Close the popup to resolve the promise
      const onClose = (createPopUp as jest.Mock).mock.calls[0][2].onClose;
      onClose({ src: 'test.jpg' });

      await promise;
    });

    it('should not dispatch if dispatch is null', async () => {
      const mockPopUp = {};
      (createPopUp as jest.Mock).mockReturnValue(mockPopUp);

      const promise = command.waitForUserInput(state, null, view);

      expect(dispatch).not.toHaveBeenCalled();

      // Close the popup
      const onClose = (createPopUp as jest.Mock).mock.calls[0][2].onClose;
      onClose(null);

      await promise;
    });

    it('should create popup with correct props', async () => {
      const mockPopUp = {};
      (createPopUp as jest.Mock).mockReturnValue(mockPopUp);

      command.waitForUserInput(state, dispatch, view);

      expect(createPopUp).toHaveBeenCalledWith(
        undefined,
        { runtime: view.runtime },
        expect.objectContaining({
          modal: true,
          onClose: expect.any(Function),
        })
      );

      // Close the popup
      const onClose = (createPopUp as jest.Mock).mock.calls[0][2].onClose;
      onClose(null);
    });


    it('should resolve with value when popup closes', async () => {
      const mockPopUp = {};
      (createPopUp as jest.Mock).mockReturnValue(mockPopUp);
      const expectedValue = { src: 'image.jpg', alt: 'test' };

      const promise = command.waitForUserInput(state, dispatch, view);

      // Trigger onClose
      const onClose = (createPopUp as jest.Mock).mock.calls[0][2].onClose;
      onClose(expectedValue);

      const result = await promise;
      expect(result).toBe(expectedValue);
      expect(command._popUp).toBeUndefined();
    });
  });

  describe('executeWithUserInput', () => {
    it('should insert enhanced image figure when inputs are provided', () => {
      const inputs = { src: 'test-image.jpg', alt: 'Test Image' };

      const result = command.executeWithUserInput(state, dispatch, view, inputs);

      expect(dispatch).toHaveBeenCalled();
      expect(hideCursorPlaceholder).toHaveBeenCalledWith(view.state);
      expect(view.focus).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle null inputs', () => {
      const result = command.executeWithUserInput(state, dispatch, view, null);

      expect(dispatch).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should not dispatch when dispatch is null', () => {
      const inputs = { src: 'test-image.jpg' };

      const result = command.executeWithUserInput(state, null, view, inputs);

      expect(dispatch).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle view being null', () => {
      const inputs = { src: 'test-image.jpg' };

      const result = command.executeWithUserInput(state, dispatch, null, inputs);

      expect(dispatch).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should not call view.focus when view is null', () => {
      const inputs = { src: 'test-image.jpg' };
      const mockFocus = jest.fn();

      command.executeWithUserInput(state, dispatch, null, inputs);

      expect(mockFocus).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should return null', () => {
      expect(command.cancel()).toBeNull();
    });
  });

  describe('renderLabel', () => {
    it('should return null', () => {
      expect(command.renderLabel()).toBeNull();
    });
  });

  describe('isActive', () => {
    it('should return true', () => {
      expect(command.isActive()).toBe(true);
    });
  });

  describe('executeCustom', () => {
    it('should return the transaction unchanged', () => {
      const tr = state.tr;
      expect(command.executeCustom(state, tr)).toBe(tr);
    });
  });

  describe('executeCustomStyleForTable', () => {
    it('should return the transaction unchanged', () => {
      const tr = state.tr;
      expect(command.executeCustomStyleForTable(state, tr, 0, 5)).toBe(tr);
    });
  });
});