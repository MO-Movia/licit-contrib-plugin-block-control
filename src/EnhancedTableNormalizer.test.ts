import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { normalizeLegacyEnhancedTableFigureBodies } from './EnhancedTableNormalizer';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
    image: {
      attrs: {
        src: { default: '' },
      },
      group: 'inline',
      inline: true,
      toDOM: () => ['img'],
      parseDOM: [{ tag: 'img' }],
    },
    enhanced_table_figure: {
      content:
        'enhanced_table_figure_body enhanced_table_figure_notes? enhanced_table_figure_capco',
      group: 'block',
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_body: {
      content: 'block',
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_notes: {
      content: 'paragraph+',
      isolating: true,
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_capco: {
      content: 'inline*',
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    },
    table: {
      group: 'block',
      tableRole: 'table',
      toDOM: () => ['table'],
      parseDOM: [{ tag: 'table' }],
    },
  },
});

describe('normalizeLegacyEnhancedTableFigureBodies', () => {
  it('wraps direct inline image children in paragraphs', () => {
    const imageNode = schema.nodes.image.create({ src: 'legacy.png' });
    const bodyNode = schema.nodes.enhanced_table_figure_body.create(
      {},
      imageNode
    );
    const capcoNode = schema.nodes.enhanced_table_figure_capco.create(
      {},
      schema.text(' ')
    );
    const figureNode = schema.nodes.enhanced_table_figure.create({}, [
      bodyNode,
      capcoNode,
    ]);
    const state = EditorState.create({
      doc: schema.nodes.doc.create({}, [figureNode]),
      schema,
    });

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);
    const normalizedBody = tr.doc.firstChild.firstChild;

    expect(tr.steps).toHaveLength(1);
    expect(normalizedBody.type.name).toBe('enhanced_table_figure_body');
    expect(normalizedBody.firstChild.type.name).toBe('paragraph');
    expect(normalizedBody.firstChild.firstChild.type.name).toBe('image');
    expect(normalizedBody.firstChild.firstChild.attrs.src).toBe('legacy.png');
  });

  it('leaves already valid body content unchanged', () => {
    const imageNode = schema.nodes.image.create({ src: 'valid.png' });
    const paragraphNode = schema.nodes.paragraph.create({}, imageNode);
    const bodyNode = schema.nodes.enhanced_table_figure_body.create(
      {},
      paragraphNode
    );
    const capcoNode = schema.nodes.enhanced_table_figure_capco.create(
      {},
      schema.text(' ')
    );
    const figureNode = schema.nodes.enhanced_table_figure.create({}, [
      bodyNode,
      capcoNode,
    ]);
    const state = EditorState.create({
      doc: schema.nodes.doc.create({}, [figureNode]),
      schema,
    });

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);

    expect(tr.steps).toHaveLength(0);
  });

  it('removes an empty paragraph created after an EIC image', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, [
      imageParagraph('image.png'),
      schema.nodes.paragraph.create(),
    ]);
    const state = createFigureState(bodyNode);

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);
    const figure = tr.doc.firstChild;

    expect(tr.steps).toHaveLength(1);
    expect(figure.firstChild.childCount).toBe(1);
    expect(figure.childCount).toBe(2);
    expect(figure.lastChild.textContent).toBe('CAPCO');
  });

  it('recovers displaced image note text into a notes wrapper', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, [
      imageParagraph('image.png'),
      schema.nodes.paragraph.create({}, schema.text('TBD')),
    ]);
    const state = createFigureState(bodyNode);

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);
    const figure = tr.doc.firstChild;

    expect(figure.firstChild.childCount).toBe(1);
    expect(figure.child(1).type.name).toBe('enhanced_table_figure_notes');
    expect(figure.child(1).textContent).toBe('TBD');
    expect(figure.lastChild.textContent).toBe('CAPCO');
  });

  it('recovers displaced table note text into a notes wrapper', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, [
      schema.nodes.table.create(),
      schema.nodes.paragraph.create({}, schema.text('Table note')),
    ]);
    const state = createFigureState(bodyNode);

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);
    const figure = tr.doc.firstChild;

    expect(figure.firstChild.childCount).toBe(1);
    expect(figure.firstChild.firstChild.type.name).toBe('table');
    expect(figure.child(1).textContent).toBe('Table note');
  });

  it('appends displaced text to existing notes', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create({}, [
      imageParagraph('image.png'),
      schema.nodes.paragraph.create({}, schema.text('Recovered')),
    ]);
    const existingNotes = schema.nodes.enhanced_table_figure_notes.create(
      {},
      schema.nodes.paragraph.create({}, schema.text('Existing'))
    );
    const state = createFigureState(bodyNode, existingNotes);

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);
    const notes = tr.doc.firstChild.child(1);

    expect(notes.childCount).toBe(2);
    expect(notes.child(0).textContent).toBe('Existing');
    expect(notes.child(1).textContent).toBe('Recovered');
  });
});

function imageParagraph(src: string) {
  return schema.nodes.paragraph.create(
    {},
    schema.nodes.image.create({ src })
  );
}

function createFigureState(bodyNode, notesNode?) {
  const capcoNode = schema.nodes.enhanced_table_figure_capco.create(
    {},
    schema.text('CAPCO')
  );
  const children = notesNode
    ? [bodyNode, notesNode, capcoNode]
    : [bodyNode, capcoNode];
  const figureNode = schema.nodes.enhanced_table_figure.create({}, children);

  return EditorState.create({
    doc: schema.nodes.doc.create({}, [figureNode]),
    schema,
  });
}
