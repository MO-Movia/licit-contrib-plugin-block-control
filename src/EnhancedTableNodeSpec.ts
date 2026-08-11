import type { NodeSpec } from 'prosemirror-model';
// Body spec – where the table (or multimedia) is inserted.
export const enhancedTableFigureBodyNodeSpec: NodeSpec = {
  group: 'block',
  selectable: false,
  // An EIC body owns exactly one payload: either its table or its image block.
  // Preventing a second block stops Enter from creating a paragraph beside
  // that payload. The isolated notes node below protects the adjacent boundary.
  content: 'block',
  parseDOM: [{ tag: "div[data-type='enhanced-table-figure-body']" }],
  toDOM() {
    return [
      'div',
      {
        'data-type': 'enhanced-table-figure-body',
        class: 'enhanced-table-figure-body',
      },
      0,
    ];
  },
};

// Optional Notes spec.
export const enhancedTableFigureNotesNodeSpec: NodeSpec = {
  group: 'block',
  content: 'paragraph+',
  // Keep ordinary join/lift commands from crossing the body/notes boundary.
  isolating: true,
  attrs: {
    styleName: { default: 'Normal' },
  },
  parseDOM: [{
    tag: "div[data-type='enhanced-table-figure-notes']",
    getAttrs: (dom: HTMLElement) => ({
      styleName: dom.dataset['stylename'] || dom.dataset['styleName'] || 'Normal',
    }),
  }],
  toDOM(node) {
    return [
      'div',
      {
        'data-type': 'enhanced-table-figure-notes',
        'data-styleName': node.attrs.styleName,
        class: 'enhanced-table-figure-notes',
      },
      0,
    ];
  },
};

// CAPCO spec – for the bottom CAPCO marking.
export const enhancedTableFigureCapcoNodeSpec: NodeSpec = {
  group: 'block',
  content: 'inline*',
  attrs: {
    form: { default: 'long' },
    capco: { default: null },
    style: { default: '' },
  },
  parseDOM: [
    {
      tag: "div[data-type='enhanced-table-figure-capco']",
      getAttrs(dom) {
        const { capco, form } = dom.dataset;
        return { form: form || 'long', capco: capco || null };
      },
    },
  ],
  toDOM(node) {
    return [
      'div',
      {
        'data-type': 'enhanced-table-figure-capco',
        'data-form': node.attrs?.form,
        'data-capco': node.attrs?.capco,
        class: 'enhanced-table-figure-capco',
      },
      0,
    ];
  },
};

// The unified Enhanced Table/Figure node spec.
// Note: The header is not part of the composite.
// Also, a new attribute "maximized" is added.
export const enhancedTableFigureNodeSpec: NodeSpec = {
  group: 'block',
  selectable: true,
  content:
    'enhanced_table_figure_body enhanced_table_figure_notes? enhanced_table_figure_capco',
  isolating: true,
  attrs: {
    id: { default: '' },
    figureType: { default: 'table' },
    orientation: { default: 'portrait' },
    maximized: { default: false },
    width: { default: 600 },
    height: { default: 300 },
  },
  parseDOM: [
    {
      tag: "div[data-type='enhanced-table-figure']",
      getAttrs(dom) {
        const dataset = dom.dataset;
        return {
          id: dataset.id || '',
          figureType: dataset.figureType || 'table',
          orientation: dataset.orientation || 'portrait',
          maximized: dataset.maximized === 'true',
        };
      },
    },
  ],
  toDOM(node) {
    return [
      'div',
      {
        'data-type': 'enhanced-table-figure',
        'data-id': node.attrs.id,
        'data-figure-type': node.attrs.figureType,
        'data-orientation': node.attrs.orientation,
        'data-maximized': node.attrs.maximized ? 'true' : 'false',
        class: `enhanced-table-figure ${node.attrs.orientation === 'landscape' ? 'landscape' : ''} ${node.attrs.maximized ? 'maximized' : ''}`,
      },
      0,
    ];
  },
};
