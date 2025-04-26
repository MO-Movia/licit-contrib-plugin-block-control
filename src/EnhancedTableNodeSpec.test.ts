import {
  enhancedTableFigureBodyNodeSpec,
  enhancedTableFigureNotesNodeSpec,
  enhancedTableFigureCapcoNodeSpec,
  enhancedTableFigureNodeSpec,
} from './EnhancedTableNodeSpec';
const mockNode = { attrs: {} } as any;
describe('Enhanced Table Figure Node Specs', () => {
  describe('enhancedTableFigureBodyNodeSpec', () => {
    it('returns correct DOM output', () => {
      const result = enhancedTableFigureBodyNodeSpec.toDOM!(mockNode);
      expect(result).toEqual([
        'div',
        {
          'data-type': 'enhanced-table-figure-body',
          class: 'enhanced-table-figure-body',
        },
        0,
      ]);
    });

    it('has correct parseDOM tag', () => {
      expect(enhancedTableFigureBodyNodeSpec.parseDOM![0].tag).toBe("div[data-type='enhanced-table-figure-body']");
    });
  });

  describe('enhancedTableFigureNotesNodeSpec', () => {
    it('returns correct DOM output', () => {
      const result = enhancedTableFigureNotesNodeSpec.toDOM!(mockNode);
      expect(result).toEqual([
        'div',
        {
          'data-type': 'enhanced-table-figure-notes',
          class: 'enhanced-table-figure-notes',
        },
        0,
      ]);
    });

    it('has correct parseDOM tag', () => {
      expect(enhancedTableFigureNotesNodeSpec.parseDOM![0].tag).toBe("div[data-type='enhanced-table-figure-notes']");
    });
  });

  describe('enhancedTableFigureCapcoNodeSpec', () => {
    it('returns correct DOM output with attrs', () => {
      const mockNode = { attrs: { form: 'short' } };
      const result = enhancedTableFigureCapcoNodeSpec.toDOM!(mockNode as any);
      expect(result).toEqual([
        'div',
        {
          'data-type': 'enhanced-table-figure-capco',
          'data-form': 'short',
          class: 'enhanced-table-figure-capco',
        },
        0,
      ]);
    });

    it('getAttrs returns correct form or default', () => {
      const tag = enhancedTableFigureCapcoNodeSpec.parseDOM![0];
      expect(tag.tag).toBe("div[data-type='enhanced-table-figure-capco']");

      const dom = document.createElement('div');
      dom.setAttribute('data-form', 'short');
      expect(tag.getAttrs!(dom)).toEqual({ form: 'short' });

      const dom2 = document.createElement('div');
      expect(tag.getAttrs!(dom2)).toEqual({ form: 'long' });
    });
  });

  describe('enhancedTableFigureNodeSpec', () => {
    it('returns correct DOM output with all attrs set', () => {
      const mockNode = {
        attrs: {
          id: 'id123',
          figureType: 'figure',
          orientation: 'landscape',
          maximized: true,
        },
      };
      const result = enhancedTableFigureNodeSpec.toDOM!(mockNode as any);
      expect(result).toEqual([
        'div',
        {
          'data-type': 'enhanced-table-figure',
          'data-id': 'id123',
          'data-figure-type': 'figure',
          'data-orientation': 'landscape',
          'data-maximized': 'true',
          class: 'enhanced-table-figure landscape maximized',
        },
        0,
      ]);
    });

    it('returns correct DOM output with defaults', () => {
      const mockNode = {
        attrs: {
          id: '',
          figureType: 'table',
          orientation: 'portrait',
          maximized: false,
        },
      };
      const result = enhancedTableFigureNodeSpec.toDOM!(mockNode as any);
      expect(result).toEqual([
        'div',
        {
          'data-type': 'enhanced-table-figure',
          'data-id': '',
          'data-figure-type': 'table',
          'data-orientation': 'portrait',
          'data-maximized': 'false',
          class: 'enhanced-table-figure  ',
        },
        0,
      ]);
    });

    it('getAttrs parses all attributes correctly', () => {
      const tag = enhancedTableFigureNodeSpec.parseDOM![0];
      const dom = document.createElement('div');
      dom.setAttribute('data-id', 'id123');
      dom.setAttribute('data-figure-type', 'figure');
      dom.setAttribute('data-orientation', 'landscape');
      dom.setAttribute('data-maximized', 'true');

      const attrs = tag.getAttrs!(dom);
      expect(attrs).toEqual({
        id: 'id123',
        figureType: 'figure',
        orientation: 'landscape',
        maximized: true,
      });
    });

    it('getAttrs falls back to defaults', () => {
      const tag = enhancedTableFigureNodeSpec.parseDOM![0];
      const dom = document.createElement('div');

      const attrs = tag.getAttrs!(dom);
      expect(attrs).toEqual({
        id: '',
        figureType: 'table',
        orientation: 'portrait',
        maximized: false,
      });
    });
  });
});
