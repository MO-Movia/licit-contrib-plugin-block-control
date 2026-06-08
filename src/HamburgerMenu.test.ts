import { TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { FigureCommandRegistry } from './HamburgerMenu';

jest.mock('prosemirror-state', () => ({
  TextSelection: jest.fn((selection) => ({ selection })),
}));

type MockTransaction = {
  delete: jest.Mock;
  doc: {
    resolve: jest.Mock;
  };
  insert: jest.Mock;
  setSelection: jest.Mock;
};

type MockView = {
  dispatch: jest.Mock;
  state: {
    schema: {
      nodes: {
        paragraph: {
          create: jest.Mock;
        };
      };
    };
    tr: MockTransaction;
  };
};

describe('FigureCommandRegistry', () => {
  let mockNode: ProseMirrorNode;
  let mockView: MockView;
  let mockTr: MockTransaction;
  let registry: FigureCommandRegistry;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTr = {
      delete: jest.fn(() => mockTr),
      doc: {
        resolve: jest.fn((pos: number) => ({ pos })),
      },
      insert: jest.fn(() => mockTr),
      setSelection: jest.fn(() => mockTr),
    };

    mockNode = {
      nodeSize: 8,
    } as unknown as ProseMirrorNode;

    mockView = {
      dispatch: jest.fn(),
      state: {
        schema: {
          nodes: {
            paragraph: {
              create: jest.fn(() => 'paragraph-node'),
            },
          },
        },
        tr: mockTr,
      },
    };

    registry = new FigureCommandRegistry(12, mockNode, mockView as unknown as EditorView);
  });

  it('inserts a paragraph above the figure and moves selection into it', () => {
    registry.insertParagraphAbove();

    expect(mockView.state.schema.nodes.paragraph.create).toHaveBeenCalledTimes(1);
    expect(mockTr.insert).toHaveBeenCalledWith(12, 'paragraph-node');
    expect(mockTr.doc.resolve).toHaveBeenCalledWith(13);
    expect(TextSelection).toHaveBeenCalledWith({ pos: 13 });
    expect(mockTr.setSelection).toHaveBeenCalledWith({ selection: { pos: 13 } });
    expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
  });

  it('inserts a paragraph below the figure and moves selection into it', () => {
    registry.insertParagraphBelow();

    expect(mockView.state.schema.nodes.paragraph.create).toHaveBeenCalledTimes(1);
    expect(mockTr.insert).toHaveBeenCalledWith(20, 'paragraph-node');
    expect(mockTr.doc.resolve).toHaveBeenCalledWith(21);
    expect(TextSelection).toHaveBeenCalledWith({ pos: 21 });
    expect(mockTr.setSelection).toHaveBeenCalledWith({ selection: { pos: 21 } });
    expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
  });

  it('deletes the figure range', () => {
    registry.deleteFigure();

    expect(mockTr.delete).toHaveBeenCalledWith(12, 20);
    expect(mockView.dispatch).toHaveBeenCalledWith(mockTr);
  });
});
