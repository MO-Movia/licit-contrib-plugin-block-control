import { DOMParser as ProseMirrorDOMParser, Fragment, Schema } from 'prosemirror-model';
import { GapCursor } from 'prosemirror-gapcursor';
import {
  EnhancedTableCommands,
  removeEmptyNotesCommand,
} from './EnhancedTableCommands';
import { EnhancedTableFigure } from './EnhancedTableFigure';
import { EnhancedTableFigureView } from './EnhancedTableFigureView';
import { normalizeLegacyEnhancedTableFigureBodies } from './EnhancedTableNormalizer';
import { ImageUploadCommand } from './ImageUploadCommand';

jest.mock('./EnhancedTableCommands', () => ({
  EnhancedTableCommands: jest.fn().mockImplementation((type, options) => ({
    options,
    type,
  })),
  removeEmptyNotesCommand: jest.fn(),
}));

jest.mock('./ImageUploadCommand', () => ({
  ImageUploadCommand: jest.fn().mockImplementation((options) => ({
    options,
    type: 'image-upload',
  })),
}));

jest.mock('./EnhancedTableFigureView', () => ({
  EnhancedTableFigureView: jest.fn().mockImplementation((node, view, getPos) => ({
    getPos,
    node,
    view,
  })),
}));

jest.mock('./EnhancedTableNormalizer', () => ({
  normalizeLegacyEnhancedTableFigureBodies: jest.fn(),
}));

describe('EnhancedTableFigure', () => {
  const createBaseSchema = () =>
    new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'inline*',
          group: 'block',
          parseDOM: [{ tag: 'p' }],
          toDOM: () => ['p', 0],
        },
        text: { group: 'inline' },
        image: {
          attrs: { src: { default: '' } },
          group: 'inline',
          inline: true,
          parseDOM: [{ tag: 'img' }],
          toDOM: () => ['img'],
        },
        table: {
          group: 'block',
          tableRole: 'table',
          parseDOM: [{ tag: 'table' }],
          toDOM: () => ['table'],
        },
      },
    });

  const getPluginSpec = () => {
    const plugin = new EnhancedTableFigure();
    return { plugin, spec: (plugin as any).spec };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles only Backspace through removeEmptyNotesCommand', () => {
    const { spec } = getPluginSpec();
    const view = { dispatch: jest.fn(), state: { doc: 'doc' } };
    (removeEmptyNotesCommand as jest.Mock).mockReturnValue(true);

    expect(spec.props.handleKeyDown(view, { key: 'ArrowRight' })).toBe(false);
    expect(removeEmptyNotesCommand).not.toHaveBeenCalled();

    expect(spec.props.handleKeyDown(view, { key: 'Backspace' })).toBe(true);
    expect(removeEmptyNotesCommand).toHaveBeenCalledWith(
      view.state,
      view.dispatch
    );
  });

  it('creates an enhanced table figure node view', () => {
    const { spec } = getPluginSpec();
    const node = { attrs: { id: 'figure-id' } };
    const view = { state: {} };
    const getPos = jest.fn(() => 5);

    const nodeView = spec.props.nodeViews.enhanced_table_figure(
      node,
      view,
      getPos
    );

    expect(EnhancedTableFigureView).toHaveBeenCalledWith(node, view, getPos);
    expect(nodeView).toEqual({ getPos, node, view });
  });

  it('runs no-op plugin state init and apply hooks', () => {
    const { spec } = getPluginSpec();

    expect(spec.state.init()).toBeUndefined();
    expect(spec.state.apply()).toBeUndefined();
  });

  it('does not append a normalizing transaction when the document did not change', () => {
    const { spec } = getPluginSpec();

    expect(
      spec.appendTransaction([{ docChanged: false }], {}, { schema: {}, tr: {} })
    ).toBeNull();
    expect(normalizeLegacyEnhancedTableFigureBodies).not.toHaveBeenCalled();
  });

  it('returns a normalizing transaction when legacy body content is repaired', () => {
    const { spec } = getPluginSpec();
    const tr = { id: 'state-tr' };
    const schema = { nodes: {} };
    const normalizedTr = { steps: [{ step: 'wrap-image' }] };
    (normalizeLegacyEnhancedTableFigureBodies as jest.Mock).mockReturnValue(
      normalizedTr
    );

    expect(
      spec.appendTransaction([{ docChanged: true }], {}, { schema, tr })
    ).toBe(normalizedTr);
    expect(normalizeLegacyEnhancedTableFigureBodies).toHaveBeenCalledWith(
      tr,
      schema
    );
  });

  it('does not append a transaction when normalization finds no changes', () => {
    const { spec } = getPluginSpec();
    (normalizeLegacyEnhancedTableFigureBodies as jest.Mock).mockReturnValue({
      steps: [],
    });

    expect(
      spec.appendTransaction(
        [{ docChanged: false }, { docChanged: true }],
        {},
        { schema: {}, tr: {} }
      )
    ).toBeNull();
  });

  it('normalizes legacy body content after the plugin view starts', async () => {
    const { spec } = getPluginSpec();
    const dispatch = jest.fn();
    const editorView = { dispatch, state: { schema: {}, tr: {} } };
    const normalizedTr = { steps: [{ step: 'wrap-image' }] };
    (normalizeLegacyEnhancedTableFigureBodies as jest.Mock).mockReturnValue(
      normalizedTr
    );

    expect(spec.view(editorView)).toEqual({});
    await Promise.resolve();

    expect(dispatch).toHaveBeenCalledWith(normalizedTr);
  });

  it('does not dispatch when startup normalization finds no changes', async () => {
    const { spec } = getPluginSpec();
    const dispatch = jest.fn();
    const editorView = { dispatch, state: { schema: {}, tr: {} } };
    (normalizeLegacyEnhancedTableFigureBodies as jest.Mock).mockReturnValue({
      steps: [],
    });

    expect(spec.view(editorView)).toEqual({});
    await Promise.resolve();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('extends the schema with enhanced figure nodes', () => {
    const { plugin } = getPluginSpec();
    const schema = plugin.getEffectiveSchema(createBaseSchema());

    expect(schema.nodes.enhanced_table_figure).toBeDefined();
    expect(schema.nodes.enhanced_table_figure_body).toBeDefined();
    expect(schema.nodes.enhanced_table_figure_image).toBeDefined();
    expect(schema.nodes.enhanced_table_figure_table).toBeDefined();
    expect(schema.nodes.enhanced_table_figure_notes).toBeDefined();
    expect(schema.nodes.enhanced_table_figure_capco).toBeDefined();

    const image = schema.nodes.image.create({ src: 'figure.png' });
    const eicImage = schema.nodes.enhanced_table_figure_image.create({}, image);
    const table = schema.nodes.table.create();
    const eicTable = schema.nodes.enhanced_table_figure_table.create({}, table);
    const paragraph = schema.nodes.paragraph.create();
    const bodyType = schema.nodes.enhanced_table_figure_body;

    expect(bodyType.validContent(Fragment.from(eicImage))).toBe(true);
    expect(bodyType.validContent(Fragment.from(eicTable))).toBe(true);
    expect(bodyType.validContent(Fragment.from(table))).toBe(false);
    expect(bodyType.validContent(Fragment.from(paragraph))).toBe(false);
  });

  it('initializes before the multimedia plugin registers its image node', () => {
    const schemaWithoutImage = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: { content: 'inline*', group: 'block' },
        text: { group: 'inline' },
        table: { group: 'block', tableRole: 'table' },
      },
    });
    const { plugin } = getPluginSpec();

    const blockControlSchema = plugin.getEffectiveSchema(schemaWithoutImage);

    expect(blockControlSchema.nodes.image).toBeUndefined();
    expect(blockControlSchema.nodes.enhanced_table_figure_image).toBeDefined();

    const nodesWithRequiredImage = blockControlSchema.spec.nodes.append({
      image: {
        attrs: { src: {} },
        group: 'inline',
        inline: true,
      },
    });
    const schemaAfterMultimedia = new Schema({
      nodes: nodesWithRequiredImage,
      marks: blockControlSchema.spec.marks,
    });
    const image = schemaAfterMultimedia.nodes.image.create({
      src: 'registered-later.png',
    });

    expect(
      schemaAfterMultimedia.nodes.enhanced_table_figure_image.validContent(
        Fragment.from(image)
      )
    ).toBe(true);
  });

  it('parses a legacy direct EIC table into the dedicated table block', () => {
    const { plugin } = getPluginSpec();
    const schema = plugin.getEffectiveSchema(createBaseSchema());
    const container = document.createElement('div');
    container.innerHTML = `
      <div data-type="enhanced-table-figure">
        <div data-type="enhanced-table-figure-body"><table></table></div>
        <div data-type="enhanced-table-figure-capco">CAPCO</div>
      </div>
    `;

    const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(container);
    const body = parsed.firstChild?.firstChild;

    expect(body?.type.name).toBe('enhanced_table_figure_body');
    expect(body?.firstChild?.type.name).toBe(
      'enhanced_table_figure_table'
    );
    expect(body?.firstChild?.firstChild?.type.name).toBe('table');
  });

  it('rejects gap cursors between the EIC payload, notes, and CAPCO', () => {
    const { plugin } = getPluginSpec();
    const schema = plugin.getEffectiveSchema(createBaseSchema());
    const table = schema.nodes.table.create();
    const tablePayload = schema.nodes.enhanced_table_figure_table.create(
      {},
      table
    );
    const body = schema.nodes.enhanced_table_figure_body.create(
      {},
      tablePayload
    );
    const notes = schema.nodes.enhanced_table_figure_notes.create(
      {},
      schema.nodes.paragraph.create({}, schema.text('TBD'))
    );
    const capco = schema.nodes.enhanced_table_figure_capco.create(
      {},
      schema.text('CAPCO')
    );
    const figure = schema.nodes.enhanced_table_figure.create({}, [
      body,
      notes,
      capco,
    ]);
    const doc = schema.nodes.doc.create({}, figure);
    const afterBody = 1 + body.nodeSize;
    const afterNotes = afterBody + notes.nodeSize;

    expect(GapCursor.valid(doc.resolve(afterBody))).toBe(false);
    expect(GapCursor.valid(doc.resolve(afterNotes))).toBe(false);
    expect(GapCursor.valid(doc.resolve(0))).toBe(true);
  });

  it('registers table and image commands', () => {
    const { plugin } = getPluginSpec();

    const commands = plugin.initButtonCommands()[
      '[exposure] Insert Enhanced Table-Figure'
    ][0];

    expect(commands[' Table']).toEqual({ options: undefined, type: 'table' });
    expect(commands[' Table with Landscape']).toEqual({
      options: { withLandscapeSection: true },
      type: 'table',
    });
    expect(commands[' Figure with Landscape']).toEqual({
      options: { withLandscapeSection: true },
      type: 'image-upload',
    });
    expect(commands[' Insert image from computer']).toEqual({
      options: undefined,
      type: 'image-upload',
    });
    expect(EnhancedTableCommands).toHaveBeenCalledTimes(2);
    expect(ImageUploadCommand).toHaveBeenCalledTimes(2);
  });
});
