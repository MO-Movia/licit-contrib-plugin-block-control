import { Schema, DOMParser, Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, NodeSelection, TextSelection, Transaction } from 'prosemirror-state';
import { Transform } from 'prosemirror-transform';
import {
    EnhancedTableCommands,
    addNotesCommand,
    convertEnhancedTableFigureToLandscape,
    convertEnhancedTableFigureToPortrait,
    deleteNotesCommand,
    isEnhancedTableFigureInLandscape,
    removeEmptyNotesCommand,
} from './EnhancedTableCommands';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { doc, p } from 'jest-prosemirror';

// Extend the basic schema with necessary nodes
const nodes = basicSchema.spec.nodes.append({
    enhanced_table_figure: {
        group: 'block',
        content: 'enhanced_table_figure_body enhanced_table_figure_notes? enhanced_table_figure_capco',
        attrs: { figureType: { default: 'table' }, orientation: { default: 'landscape' } },
        toDOM: () => ['div', 0],
        parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_body: {
        content: 'enhanced_table_figure_table',
        toDOM: () => ['div', 0],
        parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_table: {
        content: 'table',
        group: 'block',
        isolating: true,
        toDOM: () => ['div', 0],
        parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_notes: {
        content: 'paragraph+',
        toDOM: () => ['div', 0],
        parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_capco: {
        content: 'text*',
        toDOM: () => ['div', 0],
        parseDOM: [{ tag: 'div' }],
    },
    landscape_section: {
        attrs: { class: { default: 'section-landscape' } },
        content: 'block+',
        group: 'block',
        toDOM: () => ['section', { class: 'section-landscape' }, 0],
        parseDOM: [{ tag: 'section.section-landscape' }],
    },
    table: {
        content: 'table_row+',
        tableRole: 'table',
        toDOM: () => ['table', 0],
        parseDOM: [{ tag: 'table' }],
    },
    table_row: {
        content: 'table_cell+',
        tableRole: 'row',
        toDOM: () => ['tr', 0],
        parseDOM: [{ tag: 'tr' }],
    },
    table_cell: {
        content: 'paragraph+',
        attrs: { background: { default: null } },
        tableRole: 'cell',
        toDOM: (node) => ['td', { style: node.attrs.background ? `background:${node.attrs.background}` : '' }, 0],
        parseDOM: [{ tag: 'td' }],
    },
});

const schema = new Schema({ nodes, marks: basicSchema.spec.marks });

function eicTable(tableNode: ProseMirrorNode) {
    return schema.nodes.enhanced_table_figure_table.create({}, tableNode);
}

function createEicFigureNode(figureType = 'table') {
    const tableNode = schema.nodes.table.createAndFill();
    const bodyNode = schema.nodes.enhanced_table_figure_body.create(
        {},
        eicTable(tableNode)
    );
    const capcoNode = schema.nodes.enhanced_table_figure_capco.create(
        {},
        schema.text('CAPCO')
    );
    return schema.nodes.enhanced_table_figure.create(
        { figureType },
        [bodyNode, capcoNode]
    );
}

function findNodePosition(docNode: ProseMirrorNode, typeName: string): number {
    let foundPos = -1;
    docNode.descendants((node, pos) => {
        if (node.type.name === typeName) {
            foundPos = pos;
            return false;
        }
        return true;
    });
    return foundPos;
}

describe('EnhancedTableCommands', () => {
    let command: EnhancedTableCommands;
    let state: EditorState;

    beforeEach(() => {
        command = new EnhancedTableCommands('table');
        const docNode = p('Hello World');
        state = EditorState.create({ doc: docNode, schema });
    });

    test('isEnabled returns true', () => {
        expect(command.isEnabled(state)).toBe(true);
    });

    test('executeCustomStyleForTable returns tr', () => {
        const mockTr = {} as Transaction;
        expect(command.executeCustomStyleForTable(state, mockTr, 0, 0)).toBe(mockTr);
    });

    test('execute inserts enhanced table figure', () => {
        const dispatch = jest.fn();
        const view = { focus: jest.fn() } as any;

        command.execute(state, dispatch, view);

        expect(dispatch).toHaveBeenCalled();
        expect(view.focus).toHaveBeenCalled();
    });

    test('execute inserts enhanced table figure inside landscape section', () => {
        const landscapeCommand = new EnhancedTableCommands('table', {
            withLandscapeSection: true,
        });
        const landscapeState = EditorState.create({
            doc: schema.nodes.doc.create({}, [schema.nodes.paragraph.create()]),
            schema,
        });
        const dispatch = jest.fn();

        landscapeCommand.execute(landscapeState, dispatch, { focus: jest.fn() } as any);

        const tr = dispatch.mock.calls[0][0];
        const insertedNode = tr.doc.child(1);
        expect(insertedNode.type.name).toBe('landscape_section');
        expect(insertedNode.firstChild.type.name).toBe('enhanced_table_figure');
        const tablePayload = insertedNode.firstChild.firstChild.firstChild;
        expect(tablePayload.type.name).toBe('enhanced_table_figure_table');
        expect(tablePayload.firstChild.type.name).toBe('table');
    });

    test('landscape table command is disabled inside existing landscape section', () => {
        const landscapeCommand = new EnhancedTableCommands('table', {
            withLandscapeSection: true,
        });
        const landscapeState = createStateInsideLandscapeSection();

        expect(landscapeCommand.isEnabled(landscapeState)).toBe(false);
    });

    test('landscape table command does not insert inside existing landscape section', () => {
        const landscapeCommand = new EnhancedTableCommands('table', {
            withLandscapeSection: true,
        });
        const landscapeState = createStateInsideLandscapeSection();
        const dispatch = jest.fn();

        const result = landscapeCommand.execute(
            landscapeState,
            dispatch,
            { focus: jest.fn() } as any
        );

        expect(result).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('insertEnhancedTableFigure returns unchanged tr when selection is not empty', () => {
        const state = EditorState.create({ schema });
        let tr = state.tr;
        const selection = TextSelection.create(state.doc, 0, 1);
        tr = tr.setSelection(selection); // works now

        const result = command.insertEnhancedTableFigure(tr, schema);
        expect(result).toBe(tr); // unchanged when selection is not empty

    });

    test('createBlueTable creates a table node', () => {
        const tableNode = command.createBlueTable(schema, 2, 2);
        expect(tableNode.type.name).toBe('table');
        expect(tableNode.childCount).toBe(2);
    });

    test('waitForUserInput resolves to undefined', async () => {
        const result = await command.waitForUserInput(state, () => { }, {} as any, {} as any);
        expect(result).toBeUndefined();
    });

    test('executeWithUserInput returns false', () => {
        const result = command.executeWithUserInput(state, () => { }, {} as any, '');
        expect(result).toBe(false);
    });

    test('cancel returns null', () => {
        expect(command.cancel()).toBeNull();
    });
});

describe('EIC landscape conversion', () => {
    test('wraps a portrait EIC in a landscape section at the same document position', () => {
        const figure = createEicFigureNode();
        const before = schema.nodes.paragraph.create({}, schema.text('Before'));
        const after = schema.nodes.paragraph.create({}, schema.text('After'));
        const state = EditorState.create({
            doc: schema.nodes.doc.create({}, [before, figure, after]),
            schema,
        });
        const figurePos = findNodePosition(state.doc, 'enhanced_table_figure');

        expect(isEnhancedTableFigureInLandscape(state.doc, figurePos)).toBe(false);

        const tr = convertEnhancedTableFigureToLandscape(
            state.tr,
            schema,
            figurePos
        );
        const landscape = tr.doc.child(1);
        const convertedFigurePos = findNodePosition(
            tr.doc,
            'enhanced_table_figure'
        );

        expect(landscape.type.name).toBe('landscape_section');
        expect(landscape.firstChild.eq(figure)).toBe(true);
        expect(isEnhancedTableFigureInLandscape(tr.doc, convertedFigurePos)).toBe(true);
        expect(tr.selection).toBeInstanceOf(NodeSelection);
        expect((tr.selection as NodeSelection).node.type.name).toBe(
            'enhanced_table_figure'
        );
    });

    test('removes an otherwise empty landscape section around an EIC', () => {
        const figure = createEicFigureNode('figure');
        const landscape = schema.nodes.landscape_section.create(
            { class: 'custom-landscape' },
            figure
        );
        const state = EditorState.create({
            doc: schema.nodes.doc.create({}, landscape),
            schema,
        });
        const figurePos = findNodePosition(state.doc, 'enhanced_table_figure');

        const tr = convertEnhancedTableFigureToPortrait(state.tr, figurePos);

        expect(tr.doc.childCount).toBe(1);
        expect(tr.doc.firstChild.eq(figure)).toBe(true);
        expect(tr.doc.firstChild.attrs.figureType).toBe('figure');
        expect(tr.selection).toBeInstanceOf(NodeSelection);
    });

    test('keeps landscape siblings and moves the EIC after their section', () => {
        const figure = createEicFigureNode();
        const before = schema.nodes.paragraph.create({}, schema.text('Before'));
        const after = schema.nodes.paragraph.create({}, schema.text('After'));
        const landscape = schema.nodes.landscape_section.create(
            { class: 'custom-landscape' },
            [before, figure, after]
        );
        const state = EditorState.create({
            doc: schema.nodes.doc.create({}, landscape),
            schema,
        });
        const figurePos = findNodePosition(state.doc, 'enhanced_table_figure');

        const tr = convertEnhancedTableFigureToPortrait(state.tr, figurePos);
        const remainingLandscape = tr.doc.firstChild;

        expect(tr.doc.childCount).toBe(2);
        expect(remainingLandscape.type.name).toBe('landscape_section');
        expect(remainingLandscape.attrs.class).toBe('custom-landscape');
        expect(remainingLandscape.childCount).toBe(2);
        expect(remainingLandscape.child(0).textContent).toBe('Before');
        expect(remainingLandscape.child(1).textContent).toBe('After');
        expect(tr.doc.child(1).eq(figure)).toBe(true);
        expect(
            isEnhancedTableFigureInLandscape(
                tr.doc,
                findNodePosition(tr.doc, 'enhanced_table_figure')
            )
        ).toBe(false);
    });

    test('does not convert an EIC that is already in the requested orientation', () => {
        const figure = createEicFigureNode();
        const portraitState = EditorState.create({
            doc: schema.nodes.doc.create({}, figure),
            schema,
        });
        const portraitPos = findNodePosition(
            portraitState.doc,
            'enhanced_table_figure'
        );
        const portraitTr = convertEnhancedTableFigureToPortrait(
            portraitState.tr,
            portraitPos
        );

        const landscape = schema.nodes.landscape_section.create({}, figure);
        const landscapeState = EditorState.create({
            doc: schema.nodes.doc.create({}, landscape),
            schema,
        });
        const landscapePos = findNodePosition(
            landscapeState.doc,
            'enhanced_table_figure'
        );
        const landscapeTr = convertEnhancedTableFigureToLandscape(
            landscapeState.tr,
            schema,
            landscapePos
        );

        expect(portraitTr.steps).toHaveLength(0);
        expect(landscapeTr.steps).toHaveLength(0);
    });
});

function createStateInsideLandscapeSection(): EditorState {
    const docNode = schema.nodes.doc.create({}, [
        schema.nodes.landscape_section.create({}, [
            schema.nodes.paragraph.create(),
        ]),
    ]);
    const state = EditorState.create({ doc: docNode, schema });

    return state.apply(
        state.tr.setSelection(TextSelection.create(state.doc, 2))
    );
}

describe('addNotesCommand', () => {
    let state: EditorState;
    let tr: Transform;
    let pos: number;

    beforeEach(() => {
        const tableNode = schema.nodes.table.createAndFill();
        const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, eicTable(tableNode));
        const capcoNode = schema.nodes.enhanced_table_figure_capco.create({}, schema.text('Footer'));
        const figureNode = schema.nodes.enhanced_table_figure.create({}, [bodyNode, capcoNode]);

        const docNode = schema.nodes.doc.create({}, [figureNode]);
        state = EditorState.create({ doc: docNode, schema });
        tr = new Transform(state.doc);
        pos = 0;
    });

    test('adds notes when not present', () => {
        const result = addNotesCommand(tr, schema, pos);
        const newNode = result.doc.nodeAt(pos);
        expect(newNode.childCount).toBe(3);
        expect(newNode.child(1).type.name).toBe('enhanced_table_figure_notes');
    });

    test('does not add notes when already present', () => {
        const notesParagraph = schema.nodes.paragraph.create({}, schema.text('Note'));
        const notesNode = schema.nodes.enhanced_table_figure_notes.create({}, notesParagraph);
        const tableNode = schema.nodes.table.createAndFill();
        const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, eicTable(tableNode));
        const capcoNode = schema.nodes.enhanced_table_figure_capco.create({}, schema.text('Footer'));
        const figureNode = schema.nodes.enhanced_table_figure.create({}, [bodyNode, notesNode, capcoNode]);

        const docNode = schema.nodes.doc.create({}, [figureNode]);
        state = EditorState.create({ doc: docNode, schema });
        tr = new Transform(state.doc);

        const result = addNotesCommand(tr, schema, pos);
        expect(result).toBe(tr);
    });

    test('returns original tr when node is not enhanced_table_figure', () => {
        const docNode = schema.nodes.doc.create({}, [schema.nodes.paragraph.create()]);
        state = EditorState.create({ doc: docNode, schema });
        tr = new Transform(state.doc);

        const result = addNotesCommand(tr, schema, pos);
        expect(result).toBe(tr);
    });
});

describe('deleteNotesCommand', () => {
    let state: EditorState;
    let tr: Transform;
    let pos: number;

    beforeEach(() => {
        const tableNode = schema.nodes.table.createAndFill();
        const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, eicTable(tableNode));
        const notesParagraph = schema.nodes.paragraph.create({}, schema.text('Note'));
        const notesNode = schema.nodes.enhanced_table_figure_notes.create({}, notesParagraph);
        const capcoNode = schema.nodes.enhanced_table_figure_capco.create({}, schema.text('Footer'));
        const figureNode = schema.nodes.enhanced_table_figure.create({}, [bodyNode, notesNode, capcoNode]);

        const docNode = schema.nodes.doc.create({}, [figureNode]);
        state = EditorState.create({ doc: docNode, schema });
        tr = new Transform(state.doc);
        pos = 0;
    });

    test('deletes notes when present', () => {
        const result = deleteNotesCommand(tr, pos);
        const newNode = result.doc.nodeAt(pos);
        expect(newNode.childCount).toBe(2);
        expect(newNode.child(0).type.name).toBe('enhanced_table_figure_body');
        expect(newNode.child(1).type.name).toBe('enhanced_table_figure_capco');
    });

    test('returns original tr when notes are not present', () => {
        const tableNode = schema.nodes.table.createAndFill();
        const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, eicTable(tableNode));
        const capcoNode = schema.nodes.enhanced_table_figure_capco.create({}, schema.text('Footer'));
        const figureNode = schema.nodes.enhanced_table_figure.create({}, [bodyNode, capcoNode]);

        const docNode = schema.nodes.doc.create({}, [figureNode]);
        state = EditorState.create({ doc: docNode, schema });
        tr = new Transform(state.doc);

        const result = deleteNotesCommand(tr, pos);
        expect(result).toBe(tr);
    });

    test('returns original tr when node is not enhanced_table_figure', () => {
        const docNode = schema.nodes.doc.create({}, [schema.nodes.paragraph.create()]);
        state = EditorState.create({ doc: docNode, schema });
        tr = new Transform(state.doc);

        const result = deleteNotesCommand(tr, pos);
        expect(result).toBe(tr);
    });
});

describe('removeEmptyNotesCommand', () => {
    const createStateWithNotes = (noteText = '\u200B') => {
        const tableNode = schema.nodes.table.createAndFill();
        const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, eicTable(tableNode));
        const notesParagraph = schema.nodes.paragraph.create(
            {},
            noteText ? schema.text(noteText) : undefined
        );
        const notesNode = schema.nodes.enhanced_table_figure_notes.create({}, notesParagraph);
        const capcoNode = schema.nodes.enhanced_table_figure_capco.create({}, schema.text('Footer'));
        const figureNode = schema.nodes.enhanced_table_figure.create({}, [bodyNode, notesNode, capcoNode]);
        const docNode = schema.nodes.doc.create({}, [figureNode]);
        let state = EditorState.create({ doc: docNode, schema });

        const notesPos = findNodePos(docNode, 'enhanced_table_figure_notes');
        state = state.apply(
            state.tr.setSelection(TextSelection.create(state.doc, notesPos + 2))
        );

        return state;
    };

    const findNodePos = (docNode: ProseMirrorNode, typeName: string): number => {
        let foundPos = -1;
        docNode.descendants((node, nodePos) => {
            if (node.type.name === typeName) {
                foundPos = nodePos;
                return false;
            }
            return true;
        });
        return foundPos;
    };

    test('removes empty notes when selection is inside notes', () => {
        const state = createStateWithNotes();
        const dispatch = jest.fn();

        const result = removeEmptyNotesCommand(state, dispatch);

        expect(result).toBe(true);
        expect(dispatch).toHaveBeenCalledTimes(1);
        const dispatchedTr = dispatch.mock.calls[0][0] as Transaction;
        expect(findNodePos(dispatchedTr.doc, 'enhanced_table_figure_notes')).toBe(-1);
    });

    test('keeps notes that contain text', () => {
        const state = createStateWithNotes('Note');
        const dispatch = jest.fn();

        const result = removeEmptyNotesCommand(state, dispatch);

        expect(result).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('ignores selections outside notes', () => {
        const state = EditorState.create({ doc: p('Outside'), schema });
        const dispatch = jest.fn();

        const result = removeEmptyNotesCommand(state, dispatch);

        expect(result).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });
});
