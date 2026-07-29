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
      content: 'enhanced_table_figure_body enhanced_table_figure_capco',
      group: 'block',
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_body: {
      content: 'block+',
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
    },
    enhanced_table_figure_capco: {
      content: 'inline*',
      toDOM: () => ['div', 0],
      parseDOM: [{ tag: 'div' }],
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
});
