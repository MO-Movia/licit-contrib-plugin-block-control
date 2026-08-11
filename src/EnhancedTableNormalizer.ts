import { Fragment, Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { Transaction } from 'prosemirror-state';
import {
  ENHANCED_TABLE_FIGURE,
  ENHANCED_TABLE_FIGURE_BODY,
  ENHANCED_TABLE_FIGURE_NOTES,
} from './Constants';

type FigureReplacement = {
  node: ProseMirrorNode;
  pos: number;
  replacement: ProseMirrorNode;
};

type NormalizedBody = {
  body: ProseMirrorNode;
  changed: boolean;
  recoveredNotes: ProseMirrorNode[];
};

export function normalizeLegacyEnhancedTableFigureBodies(
  tr: Transaction,
  schema: Schema
): Transaction {
  const paragraphType = schema.nodes.paragraph;
  const notesType = schema.nodes[ENHANCED_TABLE_FIGURE_NOTES];
  if (!paragraphType || !notesType) {
    return tr;
  }

  const replacements: FigureReplacement[] = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== ENHANCED_TABLE_FIGURE) {
      return true;
    }

    const replacement = normalizeFigure(node, paragraphType, notesType);
    if (replacement) {
      replacements.push({ node, pos, replacement });
    }

    return false;
  });

  for (const { node, pos, replacement } of replacements.reverse()) {
    tr = tr.replaceWith(pos, pos + node.nodeSize, replacement);
  }

  return tr;
}

function normalizeFigure(
  figure: ProseMirrorNode,
  paragraphType,
  notesType
): ProseMirrorNode | null {
  const children = getChildren(figure);
  const bodyIndex = children.findIndex(
    (child) => child.type.name === ENHANCED_TABLE_FIGURE_BODY
  );
  if (bodyIndex < 0) {
    return null;
  }

  const normalized = normalizeBody(children[bodyIndex], paragraphType);
  if (!normalized.changed) {
    return null;
  }

  const notesIndex = children.findIndex(
    (child) => child.type.name === ENHANCED_TABLE_FIGURE_NOTES
  );
  const nextChildren: ProseMirrorNode[] = [];

  children.forEach((child, index) => {
    if (index === bodyIndex) {
      nextChildren.push(normalized.body);
      if (notesIndex < 0 && normalized.recoveredNotes.length) {
        nextChildren.push(
          notesType.create({}, Fragment.fromArray(normalized.recoveredNotes))
        );
      }
      return;
    }

    if (index === notesIndex && normalized.recoveredNotes.length) {
      nextChildren.push(
        child.type.create(
          child.attrs,
          child.content.append(Fragment.fromArray(normalized.recoveredNotes)),
          child.marks
        )
      );
      return;
    }

    nextChildren.push(child);
  });

  return figure.type.create(
    figure.attrs,
    Fragment.fromArray(nextChildren),
    figure.marks
  );
}

function normalizeBody(body: ProseMirrorNode, paragraphType): NormalizedBody {
  let changed = false;
  const bodyChildren = getChildren(body).map((child) => {
    if (child.type.name === 'image' && child.isInline) {
      changed = true;
      return paragraphType.create({}, child);
    }
    return child;
  });

  const primary = bodyChildren[0];
  const extras = bodyChildren.slice(1);
  const canRecoverExtras =
    !!primary &&
    isPayloadBlock(primary) &&
    extras.every(isRecoverableParagraph);

  let recoveredNotes: ProseMirrorNode[] = [];
  let normalizedChildren = bodyChildren;
  if (extras.length && canRecoverExtras) {
    normalizedChildren = [primary];
    recoveredNotes = extras.filter((child) => !isEmptyParagraph(child));
    changed = true;
  }

  const normalizedBody = changed
    ? body.type.create(
      body.attrs,
      Fragment.fromArray(normalizedChildren),
      body.marks
    )
    : body;

  return { body: normalizedBody, changed, recoveredNotes };
}

function getChildren(node: ProseMirrorNode): ProseMirrorNode[] {
  return Array.from(
    { length: node.childCount },
    (_, index) => node.child(index)
  );
}

function isPayloadBlock(node: ProseMirrorNode): boolean {
  if (node.type.spec.tableRole === 'table' || node.type.name === 'image') {
    return true;
  }

  let containsImage = false;
  node.descendants((child) => {
    if (child.type.name === 'image') {
      containsImage = true;
      return false;
    }
    return !containsImage;
  });
  return containsImage;
}

function isRecoverableParagraph(node: ProseMirrorNode): boolean {
  return node.type.name === 'paragraph' && !isPayloadBlock(node);
}

function isEmptyParagraph(node: ProseMirrorNode): boolean {
  let hasNonTextContent = false;
  node.descendants((child) => {
    if (!child.isText) {
      hasNonTextContent = true;
      return false;
    }
    return true;
  });

  return (
    !hasNonTextContent &&
    node.textContent.replace(/\u200B/g, '').trim().length === 0
  );
}
