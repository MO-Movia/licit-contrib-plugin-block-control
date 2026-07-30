import { Fragment, Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { Transaction } from 'prosemirror-state';
import { ENHANCED_TABLE_FIGURE_BODY } from './Constants';

type BodyReplacement = {
  node: ProseMirrorNode;
  pos: number;
  replacement: ProseMirrorNode;
};

export function normalizeLegacyEnhancedTableFigureBodies(
  tr: Transaction,
  schema: Schema
): Transaction {
  const paragraphType = schema.nodes.paragraph;
  if (!paragraphType) {
    return tr;
  }

  const replacements: BodyReplacement[] = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== ENHANCED_TABLE_FIGURE_BODY) {
      return true;
    }

    let changed = false;
    const children: ProseMirrorNode[] = [];
    node.forEach((child) => {
      if (child.type.name === 'image' && child.isInline) {
        children.push(paragraphType.create({}, child));
        changed = true;
        return;
      }

      children.push(child);
    });

    if (changed) {
      replacements.push({
        node,
        pos,
        replacement: node.type.create(
          node.attrs,
          Fragment.fromArray(children),
          node.marks
        ),
      });
    }

    return false;
  });

  for (const { node, pos, replacement } of replacements.reverse()) {
    tr = tr.replaceWith(pos, pos + node.nodeSize, replacement);
  }

  return tr;
}
