import type { NodeSpec } from 'prosemirror-model';


// Shared attribute extraction for both image types
export function getBaseAttrs(dom: HTMLElement) {
  let { width, height } = dom.style;

  width = width || (dom.getAttribute('width') ?? '');
  height = height || (dom.getAttribute('height') ?? '');

  const attrfitToParent = dom.getAttribute('fitToParent');
  let fitToParent = 0;
  if (attrfitToParent) {
    fitToParent = parseInt(attrfitToParent);
  }

  return {
    alt: dom.getAttribute('alt') || '',
    height: parseInt(height, 10) || null,
    src: dom.getAttribute('src'),
    title: dom.getAttribute('title') || '',
    width: parseInt(width, 10) || null,
    fitToParent,
    simpleImg: dom.getAttribute('simpleImg') || 'false'
  };
}


export function getAttrsSimple(dom: string | HTMLElement) {
  if (typeof dom === 'string') return false;
  if (
    dom.getAttribute('simple-img') || dom.getAttribute('simpleImg')) {
    return getBaseAttrs(dom);

  }
  return false;
}

export const SimpleImageNodeSpec: NodeSpec = {
  inline: true,
  attrs: {
    alt: { default: '' },
    height: { default: null },
    src: { default: null },
    title: { default: '' },
    width: { default: null },
    fitToParent: { default: 0 },
    smpleImg: { default: 'true' }
  },
  group: 'inline',
  draggable: true,
  parseDOM: [{ tag: 'img[src]', getAttrs: getAttrsSimple }],
  toDOM(node) {
    return ['img', node.attrs];
  },
};