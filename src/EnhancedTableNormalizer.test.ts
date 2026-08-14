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
        width: { default: null },
        cropData: { default: null },
      },
      group: 'inline',
      inline: true,
      toDOM: () => ['img'],
      parseDOM: [{ tag: 'img' }],
    },
    enhanced_table_figure_image: {
      content: 'inline?',
      group: 'block',
      isolating: true,
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
    enhanced_table_figure: {
      content:
        'enhanced_table_figure_body enhanced_table_figure_notes? enhanced_table_figure_capco',
      group: 'block',
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_body: {
      content:
        '(enhanced_table_figure_table | enhanced_table_figure_image)',
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
  it('migrates a legacy direct image into the EIC image block', () => {
    const imageNode = schema.nodes.image.create({
      src: 'legacy.png',
      width: 320,
      cropData: { left: 5 },
    });
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
    expect(normalizedBody.firstChild.type.name).toBe(
      'enhanced_table_figure_image'
    );
    expect(normalizedBody.firstChild.firstChild.type.name).toBe('image');
    expect(normalizedBody.firstChild.firstChild.attrs.src).toBe('legacy.png');
    expect(normalizedBody.firstChild.firstChild.attrs.width).toBe(320);
    expect(normalizedBody.firstChild.firstChild.attrs.cropData).toEqual({
      left: 5,
    });
  });

  it('migrates a legacy image paragraph into the EIC image block', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create(
      {},
      imageParagraph('legacy-paragraph.png')
    );
    const state = createFigureState(bodyNode);

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);
    const payload = tr.doc.firstChild.firstChild.firstChild;

    expect(tr.steps).toHaveLength(1);
    expect(payload.type.name).toBe('enhanced_table_figure_image');
    expect(payload.firstChild.attrs.src).toBe('legacy-paragraph.png');
  });

  it('leaves the current EIC image block unchanged', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create(
      {},
      eicImage('valid.png')
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

  it('migrates a legacy direct table into the EIC table block', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create(
      {},
      schema.nodes.table.create()
    );
    const state = createFigureState(bodyNode);

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);
    const payload = tr.doc.firstChild.firstChild.firstChild;

    expect(tr.steps).toHaveLength(1);
    expect(payload.type.name).toBe('enhanced_table_figure_table');
    expect(payload.firstChild.type.name).toBe('table');
  });

  it('leaves the current EIC table block unchanged', () => {
    const bodyNode = schema.nodes.enhanced_table_figure_body.create(
      {},
      eicTable()
    );
    const state = createFigureState(bodyNode);

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);

    expect(tr.steps).toHaveLength(0);
  });

  it('does not change ordinary images outside an EIC', () => {
    const paragraph = imageParagraph('ordinary.png');
    const state = EditorState.create({
      doc: schema.nodes.doc.create({}, [paragraph]),
      schema,
    });

    const tr = normalizeLegacyEnhancedTableFigureBodies(state.tr, schema);

    expect(tr.steps).toHaveLength(0);
    expect(tr.doc.firstChild.firstChild.attrs.src).toBe('ordinary.png');
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
    expect(figure.firstChild.firstChild.type.name).toBe(
      'enhanced_table_figure_image'
    );
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
    expect(figure.firstChild.firstChild.type.name).toBe(
      'enhanced_table_figure_table'
    );
    expect(figure.firstChild.firstChild.firstChild.type.name).toBe('table');
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

function eicImage(src: string) {
  return schema.nodes.enhanced_table_figure_image.create(
    {},
    schema.nodes.image.create({ src })
  );
}

function eicTable() {
  return schema.nodes.enhanced_table_figure_table.create(
    {},
    schema.nodes.table.create()
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
